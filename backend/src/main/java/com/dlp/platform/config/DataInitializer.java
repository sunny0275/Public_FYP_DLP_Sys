package com.dlp.platform.config;

import com.dlp.platform.entity.User;
import com.dlp.platform.repository.UserRepository;
import com.dlp.platform.util.PasswordUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.Comparator;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class DataInitializer {

    private final UserRepository userRepository;
    private final PasswordUtil passwordUtil;

    @Value("${security.admin.password}")
    private String adminPassword;

    @Bean
    public CommandLineRunner initDatabase() {
        return args -> {
            // Always sanitize legacy roles first (e.g., ROLE/USER remnants)
            sanitizeLegacyRoles();

            // Update existing admin users with configured password and policy
            // Find all users with ADMIN role
            List<User> adminUsers = userRepository.findByRole("ADMIN");
            
            if (!adminUsers.isEmpty()) {
                int updatedCount = 0;
                
                for (User adminUser : adminUsers) {
                    String hashedPassword = passwordUtil.hashPassword(adminPassword);
                    adminUser.setHashedPassword(hashedPassword);
                    adminUser.setFirstLogin(false);
                    adminUser.setPasswordChangeRequired(false);
                    // Disable password expiry for admin so it is not subject to normal expiry policy
                    adminUser.setPasswordExpiryDate(null);

                    // Ensure admin has ADMIN role
                    Set<String> roles = adminUser.getRoles() != null ? new HashSet<>(adminUser.getRoles()) : new HashSet<>();
                    roles.add("ADMIN");
                    adminUser.setRoles(roles);

                    // Ensure admin account is enabled and unlocked
                    adminUser.setAccountEnabled(true);
                    adminUser.setAccountLocked(false);

                    userRepository.save(adminUser);
                    updatedCount++;
                }

                if (updatedCount > 0) {
                    log.debug("Updated {} admin account(s) with password policy", updatedCount);
                }
            }
        };
    }

    /**
     * Remove legacy `USER` role across the DB.
     * - If a user has only USER -> replace with EMPLOYEE (lowest privilege).
     * - If a user has ADMIN + USER (legacy seed) -> remove USER.
     */
    private void sanitizeLegacyRoles() {
        final var users = safeFindAllUsers();
        if (users == null) {
            // Schema might be mid-migration (or DB is down). Don't crash-loop the whole service.
            return;
        }
        int updated = 0;

        for (User u : users) {
            if (u.getRoles() == null || u.getRoles().isEmpty()) continue;

            // Normalize + collapse to EXACTLY one role (keep highest privilege if multiple)
            Set<String> normalized = new HashSet<>();
            for (String role : u.getRoles()) {
                if (role == null) continue;
                String r = role.trim().toUpperCase();
                if (r.startsWith("ROLE_")) r = r.substring("ROLE_".length());
                if ("USER".equals(r)) r = "EMPLOYEE";
                if (!r.isBlank()) normalized.add(r);
            }
            if (normalized.isEmpty()) {
                normalized.add("EMPLOYEE");
            }

            String chosen = chooseHighestRole(normalized);
            Set<String> newRoles = Set.of(chosen);

            if (!newRoles.equals(u.getRoles())) {
                u.setRoles(new HashSet<>(newRoles));
                userRepository.save(u);
                updated++;
            }
        }

        if (updated > 0) {
            log.info("Sanitized roles for {} user(s) (normalized + enforced single role).", updated);
        }
    }

    private String chooseHighestRole(Set<String> roles) {
        // Prefer known roles by hierarchy; fallback to deterministic lexical choice.
        return roles.stream()
            .map(r -> r.trim().toUpperCase())
            .max(Comparator.comparingInt(this::roleRank)
                .thenComparing(Comparator.naturalOrder()))
            .orElse("EMPLOYEE");
    }

    private int roleRank(String role) {
        try {
            return com.dlp.platform.enums.Role.valueOf(role).getHierarchyLevel();
        } catch (Exception ignored) {
            return 0;
        }
    }

    private java.util.List<User> safeFindAllUsers() {
        try {
            return userRepository.findAll();
        } catch (Exception e) {
            log.error("Skipping legacy role sanitization because querying `users` failed (likely schema mismatch during startup). " +
                    "Fix the DB schema and restart the service.", e);
            return null;
        }
    }
}
