package com.dlp.platform.service.admin;

import com.dlp.platform.dto.user.CreateUserRequest;
import com.dlp.platform.dto.user.UpdateProfileRequest;
import com.dlp.platform.dto.user.UpdateUserRequest;
import com.dlp.platform.dto.user.UserCreationResult;
import com.dlp.platform.dto.user.UserProfileResponse;
import com.dlp.platform.dto.user.UserResponse;
import com.dlp.platform.entity.AccountIdHistory;
import com.dlp.platform.entity.User;
import com.dlp.platform.exception.AccountLockedException;
import com.dlp.platform.exception.InvalidPasswordException;
import com.dlp.platform.exception.ResourceNotFoundException;
import com.dlp.platform.repository.AccountIdHistoryRepository;
import com.dlp.platform.repository.DocumentActivityRepository;
import com.dlp.platform.repository.DocumentRepository;
import com.dlp.platform.repository.DocumentVersionRepository;
import com.dlp.platform.repository.SignatureRepository;
import com.dlp.platform.repository.UploadJobRepository;
import com.dlp.platform.repository.UserRepository;
import com.dlp.platform.util.MfaUtil;
import com.dlp.platform.util.PasswordUtil;
import com.dlp.platform.service.audit.AuditLogService;
import com.dlp.platform.service.key.KeyManagementService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final DocumentRepository documentRepository;
    private final DocumentActivityRepository documentActivityRepository;
    private final UploadJobRepository uploadJobRepository;
    private final DocumentVersionRepository documentVersionRepository;
    private final SignatureRepository signatureRepository;
    private final AccountIdHistoryRepository accountIdHistoryRepository;
    private final PasswordUtil passwordUtil;
    private final MfaUtil mfaUtil;
    private final AuditLogService auditLogService;
    private final KeyManagementService keyManagementService;

    @Value("${security.password.expiry-days}")
    private int passwordExpiryDays;

    @Value("${security.account.lockout-duration-minutes}")
    private int lockoutDurationMinutes;

    @Value("${security.account.max-login-attempts}")
    private int maxLoginAttempts;

    @Value("${security.mfa.login-max-attempts:5}")
    private int mfaMaxLoginAttempts;

    @Value("${security.mfa.login-lockout-minutes:5}")
    private int mfaLockoutMinutes;

    /**
     * Generate an employee-style account ID based on department + role + current year + sequence number.
     * Example: IT_RE_2025_001 (IT Department, REVIEWER)
     */
    private String generateEmployeeAccountId(String department, Set<String> roles) {
        String year = String.valueOf(LocalDateTime.now().getYear());

        String depRaw = (department == null || department.isBlank()) ? "GEN" : department;
        String depCode = abbreviate(depRaw);
        if (depCode.isBlank()) depCode = "GEN";

        // Derive role code from user's primary role (highest privilege)
        String roleCode = deriveRoleCode(roles);

        String prefix = depCode + "_" + roleCode + "_" + year + "_";

        // Prefer history count so sequences never go backwards after purge.
        long existingUsers = userRepository.countByAccountIdStartingWith(prefix);
        long existingHistory = accountIdHistoryRepository.countByPrefix(prefix);
        long next = Math.max(existingUsers, existingHistory) + 1;

        // Find the first unused ID across both tables
        while (true) {
            String candidate = prefix + String.format("%03d", next);
            if (!userRepository.existsByAccountId(candidate) && !accountIdHistoryRepository.existsByAccountId(candidate)) {
                return candidate;
            }
            next++;
        }
    }

    /**
     * Derive 2-letter role code from user's roles.
     * Priority: ADMIN > MANAGER > REVIEWER > EMPLOYEE
     */
    private String deriveRoleCode(Set<String> roles) {
        if (roles == null || roles.isEmpty()) {
            return "EM"; // Default for no role
        }

        // Check in hierarchy order (highest privilege first)
        if (roles.contains("ADMIN")) return "AD";
        if (roles.contains("MANAGER")) return "MG";
        if (roles.contains("REVIEWER")) return "RE";
        if (roles.contains("EMPLOYEE")) return "EM";

        // Fallback for any other role
        return "EM";
    }

    private String abbreviate(String raw) {
        String cleaned = raw.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
        if (cleaned.length() <= 2) {
            return cleaned;
        }
        return cleaned.substring(0, 2);
    }

    /**
     * Create a new user with initial password
     * Returns UserCreationResult with initial password for secure communication
     */
    @Transactional
    public UserCreationResult createUser(CreateUserRequest request) {
        log.info("Creating new user (requested accountId={}): {}", request.getAccountId(), request.getEmail());

        // Always auto-generate employee account ID based on department + role + year + sequence
        String resolvedAccountId = generateEmployeeAccountId(request.getDepartment(), request.getRoles());
        log.info("Auto-generated accountId for new user: {}", resolvedAccountId);

        // Check if accountId already exists or was used previously (even if purged)
        if (userRepository.existsByAccountId(resolvedAccountId) || accountIdHistoryRepository.existsByAccountId(resolvedAccountId)) {
            throw new IllegalArgumentException("User already exists with this account ID: " + resolvedAccountId);
        }

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("User already exists with this email: " + request.getEmail());
        }

        // Generate secure initial password
        String initialPassword = passwordUtil.generateSecurePassword(12);

        // Hash the password
        String hashedPassword = passwordUtil.hashPassword(initialPassword);

        // Set password expiry date
        LocalDateTime passwordExpiryDate = LocalDateTime.now().plusDays(passwordExpiryDays);

        // Create user entity
        Set<String> normalizedRoles = normalizeSingleRoleOrDefault(request.getRoles());
        User user = User.builder()
                .accountId(resolvedAccountId)
                .email(request.getEmail())
                .fullName(request.getFullName())
                .department(request.getDepartment())
                .position(request.getPosition())
                .hashedPassword(hashedPassword)
                .roles(new HashSet<>(normalizedRoles))
                .passwordChangedAt(LocalDateTime.now())
                .passwordExpiryDate(passwordExpiryDate)
                .firstLogin(true)
                .passwordChangeRequired(true)
                .mfaEnabled(false)
                .accountEnabled(true)
                .accountLocked(false)
                .loginAttempts(0)
                .passwordHistory(new ArrayList<>())
                .build();

        User savedUser = userRepository.save(user);
        log.info("User created successfully: {}", savedUser.getAccountId());

        // Record permanently to prevent re-use after purge
        recordAccountIdIfMissing(savedUser.getAccountId(), "USER_CREATED");

        // Auto-setup encryption key for the new user using the initial password
        // Per Phase 05: Key Initialization - when account is generated, automatically setup encryption key
        if (keyManagementService.isEnabled()) {
            try {
                KeyManagementService.KeySetupResult keyResult = keyManagementService.setupKey(
                    savedUser.getId(), initialPassword);
                log.info("Auto-provisioned encryption key for user {} (keyVersion={})",
                    savedUser.getAccountId(), keyResult.keyVersion());
            } catch (Exception e) {
                log.error("Failed to auto-provision encryption key for user {}: {}",
                    savedUser.getAccountId(), e.getMessage());
            }
        }

        // Return DTO with initial password - NEVER store plaintext in entity
        return UserCreationResult.builder()
                .userId(savedUser.getId())
                .accountId(savedUser.getAccountId())
                .email(savedUser.getEmail())
                .fullName(savedUser.getFullName())
                .initialPassword(initialPassword)
                .build();
    }

    /**
     * Preview next generated accountId for admin UI.
     */
    public String previewNextAccountId(String department, Set<String> roles) {
        return generateEmployeeAccountId(department, roles);
    }

    private Set<String> normalizeSingleRoleOrDefault(Set<String> roles) {
        // Enforce exactly one role.
        if (roles == null || roles.isEmpty()) {
            return new HashSet<>(Set.of("EMPLOYEE"));
        }
        if (roles.size() != 1) {
            throw new IllegalArgumentException("Exactly one role is required");
        }
        String role = roles.iterator().next();
        if (role == null || role.isBlank()) {
            return new HashSet<>(Set.of("EMPLOYEE"));
        }
        String r = role.trim().toUpperCase();
        if (r.startsWith("ROLE_")) {
            r = r.substring("ROLE_".length());
        }
        // Legacy role cleanup: USER is no longer used; map it to the lowest privilege role.
        if ("USER".equals(r)) {
            r = "EMPLOYEE";
        }
        return new HashSet<>(Set.of(r));
    }

    /**
     * Update existing user (Admin only)
     * Updates roles, department, and account status
     * FR-003, FR-005: Allow admins to modify user attributes
     * Increments tokenVersion if roles change to invalidate existing JWT tokens
     */
    @Transactional
    public UserResponse updateUser(Long userId, UpdateUserRequest request) {
        log.info("Updating user ID: {}", userId);

        User user = findById(userId);

        // Check if email is changing and if new email already exists
        if (!user.getEmail().equals(request.getEmail())) {
            if (userRepository.existsByEmail(request.getEmail())) {
                throw new IllegalArgumentException("User already exists with this email: " + request.getEmail());
            }
            user.setEmail(request.getEmail());
        }

        // Enforce a single valid role and normalize legacy values
        Set<String> newRoles = normalizeSingleRoleOrDefault(new HashSet<>(request.getRoles()));
        boolean rolesChanged = !user.getRoles().equals(newRoles);

        // Update user fields
        user.setFullName(request.getFullName());
        user.setDepartment(request.getDepartment());
        user.setRoles(newRoles);

        // Increment token version if roles changed (invalidates existing JWT tokens)
        if (rolesChanged) {
            user.setTokenVersion(user.getTokenVersion() + 1);
            log.info("Roles changed for user {}, incrementing tokenVersion to {}", user.getAccountId(), user.getTokenVersion());
        }

        // Update account status if provided
        if (request.getAccountEnabled() != null) {
            user.setAccountEnabled(request.getAccountEnabled());
        }

        User updatedUser = userRepository.save(user);
        log.info("User updated successfully: {}", updatedUser.getAccountId());

        return convertToResponse(updatedUser);
    }

    /**
     * Find user by ID
     */
    public User findById(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with ID: " + userId));
    }

    /**
     * Check if user has admin role
     */
    private boolean hasAdminRole(User user) {
        if (user.getRoles() == null || user.getRoles().isEmpty()) {
            return false;
        }
        return user.getRoles().stream()
                .map(role -> {
                    if (role == null) return "";
                    String r = role.trim().toUpperCase();
                    if (r.startsWith("ROLE_")) r = r.substring("ROLE_".length());
                    return r;
                })
                .anyMatch("ADMIN"::equals);
    }

    /**
     * Reset UEBA scores for all normal users back to 100.
     * Optionally re-enable disabled accounts to recover from penalty actions.
     * Admin accounts are EXCLUDED from reset (score must remain 100).
     *
     * @return number of users updated
     */
    @Transactional
    public int resetAllUebaScores(boolean enableAccounts) {
        List<User> users = userRepository.findAll().stream()
                .filter(u -> !Boolean.TRUE.equals(u.getSystemAccount()))
                .filter(u -> u.getDeletedAt() == null)
                .filter(u -> u.getAccountId() == null || !u.getAccountId().startsWith("archived_"))
                .collect(Collectors.toList());

        int updated = 0;
        for (User user : users) {
            // Admin accounts are protected: UEBA score must remain 100
            if (hasAdminRole(user)) {
                log.debug("Skipping UEBA reset for admin account {}", user.getAccountId());
                continue;
            }

            boolean changed = false;
            if (user.getUebaScore() == null || user.getUebaScore() != 100) {
                user.setUebaScore(100);
                changed = true;
            }
            if (enableAccounts && Boolean.FALSE.equals(user.getAccountEnabled())) {
                user.setAccountEnabled(true);
                user.setAccountLocked(false);
                user.setAccountLockedUntil(null);
                user.setAccountLockLevel(0);
                user.setLoginAttempts(0);
                changed = true;
            }
            if (changed) {
                userRepository.save(user);
                updated++;
            }
        }

        log.info("UEBA score reset completed: updated={} enableAccounts={}", updated, enableAccounts);
        return updated;
    }

    /**
     * Reset UEBA score for a specific user back to 100.
     * Optionally re-enable the account in the same operation.
     * Admin accounts are EXCLUDED from reset (score must remain 100).
     */
    @Transactional
    public UserResponse resetUserUebaScore(Long userId, boolean enableAccount) {
        User user = findById(userId);

        if (Boolean.TRUE.equals(user.getSystemAccount())) {
            throw new IllegalArgumentException("System account UEBA score cannot be reset");
        }
        if (user.getDeletedAt() != null || (user.getAccountId() != null && user.getAccountId().startsWith("archived_"))) {
            throw new IllegalArgumentException("Archived/deleted user UEBA score cannot be reset");
        }
        // Admin accounts are protected: UEBA score must remain 100
        if (hasAdminRole(user)) {
            throw new IllegalArgumentException("Admin account UEBA score cannot be manually reset (score must remain 100)");
        }

        user.setUebaScore(100);
        if (enableAccount) {
            user.setAccountEnabled(true);
            user.setAccountLocked(false);
            user.setAccountLockedUntil(null);
            user.setAccountLockLevel(0);
            user.setLoginAttempts(0);
        }

        User saved = userRepository.save(user);
        log.info("UEBA score reset for user {} (id={}) enableAccount={}", saved.getAccountId(), saved.getId(), enableAccount);
        return convertToResponse(saved);
    }

    /**
     * Find user by account ID
     */
    public User findByAccountId(String accountId) {
        return userRepository.findByAccountId(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + accountId));
    }

    /**
     * Find user by email
     */
    public User findByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + email));
    }

    /**
     * Get all users (admin only)
     */
    public List<UserResponse> getAllUsers() {
        return userRepository.findAll().stream()
                // Hide system identities (e.g., archive identities) from the normal user table.
                .filter(u -> !Boolean.TRUE.equals(u.getSystemAccount()))
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    /**
     * Change user password
     */
    @Transactional
    public void changePassword(Long userId, String oldPassword, String newPassword) {
        log.info("Changing password for user ID: {}", userId);

        User user = findById(userId);

        // Verify old password (skip verification if first login or password change required)
        if (!user.getFirstLogin() && !user.getPasswordChangeRequired()) {
            if (!passwordUtil.verifyPassword(oldPassword, user.getHashedPassword())) {
                throw new InvalidPasswordException("Current password is incorrect");
            }
        }

        // Prevent new password from matching the current one
        if (passwordUtil.verifyPassword(newPassword, user.getHashedPassword())) {
            throw new InvalidPasswordException("New password must be different from the current password");
        }

        // Validate new password complexity
        PasswordUtil.PasswordValidationResult validation = passwordUtil.validatePasswordComplexity(newPassword);
        if (!validation.isValid()) {
            throw new InvalidPasswordException(validation.getErrorMessage());
        }

        // Check password history
        if (passwordUtil.isPasswordInHistory(newPassword, user.getPasswordHistory())) {
            throw new InvalidPasswordException("Password has been used recently. Please choose a different password");
        }

        // Rotate user key material together with password rotation.
        // If key was revoked (no active key), reinitialize it with new password.
        // For first login or password change required, skip key rotation (initial password already set up the key).
        if (keyManagementService.isEnabled()) {
            boolean isFirstTimeSetup = user.getFirstLogin() || user.getPasswordChangeRequired();
            if (!keyManagementService.hasKey(userId) || !keyManagementService.isKeyActive(userId)) {
                // Key was revoked or doesn't exist - reinitialize with new password
                KeyManagementService.KeySetupResult keyResult = keyManagementService.setupKey(userId, newPassword);
                log.info("Reinitialized encryption key for user {} after revocation (keyVersion={})",
                    user.getAccountId(), keyResult.keyVersion());
            } else if (!isFirstTimeSetup && oldPassword != null && !oldPassword.isBlank()) {
                // Normal key rotation with old password verification
                keyManagementService.regenerateKey(userId, oldPassword, newPassword);
            }
        }

        // Hash new password
        String newHashedPassword = passwordUtil.hashPassword(newPassword);

        // Update password history
        List<String> updatedHistory = passwordUtil.updatePasswordHistory(
                user.getPasswordHistory(),
                user.getHashedPassword()
        );

        // Update user
        user.setHashedPassword(newHashedPassword);
        user.setPasswordHistory(updatedHistory);
        user.setPasswordChangedAt(LocalDateTime.now());
        user.setPasswordExpiryDate(LocalDateTime.now().plusDays(passwordExpiryDays));
        user.setFirstLogin(false);
        user.setPasswordChangeRequired(false);

        userRepository.save(user);
        log.info("Password changed successfully for user: {}", user.getAccountId());
    }

    /**
     * Setup MFA for user
     */
    @Transactional
    public MfaUtil.MfaSetupData setupMfa(Long userId) {
        log.info("Setting up MFA for user ID: {}", userId);

        User user = findById(userId);

        // Generate MFA secret
        MfaUtil.MfaSetupData setupData = mfaUtil.createMfaSetup(user.getAccountId());

        // Save MFA secret (not enabled yet, will be enabled after verification)
        user.setMfaSecret(setupData.getSecret());
        userRepository.save(user);

        log.info("MFA setup initiated for user: {}", user.getAccountId());
        return setupData;
    }

    /**
     * Enable MFA after verification
     */
    @Transactional
    public void enableMfa(Long userId, int verificationCode) {
        log.debug("MFA verify request for user ID: {}", userId);

        User user = findById(userId);

        if (user.getMfaSecret() == null) {
            log.error("MFA secret is null for user ID: {}", userId);
            throw new IllegalStateException("MFA secret not set. Please setup MFA first");
        }

        // Verify the code - use window of 3 (±90 seconds) to handle clock drift
        boolean isValid = mfaUtil.verifyCodeWithWindow(user.getMfaSecret(), verificationCode, 3);
        
        if (!isValid) {
            log.warn("MFA verify FAILED for user ID: {}", userId);
            throw new IllegalArgumentException("Invalid verification code");
        }

        user.setMfaEnabled(true);
        userRepository.save(user);
        log.info("MFA enabled successfully for user: {}", user.getAccountId());
    }

    /**
     * Verify MFA code
     */
    public boolean verifyMfaCode(Long userId, int code) {
        User user = findById(userId);

        if (!user.getMfaEnabled() || user.getMfaSecret() == null) {
            log.warn("verifyMfaCode: MFA not enabled or secret null for user {}", userId);
            return false;
        }

        return mfaUtil.verifyCodeWithWindow(user.getMfaSecret(), code, 3);
    }

    /**
     * Handle login attempt
     */
    @Transactional
    public void handleLoginAttempt(String accountId, boolean success) {
        User user = userRepository.findByAccountId(accountId).orElse(null);
        if (user == null) {
            return;
        }

        if (success) {
            // Reset login attempts on successful login
            user.resetLoginAttempts();
            user.setLastLoginAt(LocalDateTime.now());
        } else {
            // Increment failed attempts
            user.incrementLoginAttempts();

            // Lock account with exponential backoff if max attempts reached
            if (user.getLoginAttempts() >= maxLoginAttempts) {
                int currentLevel = user.getAccountLockLevel();
                int nextLevel = Math.min(currentLevel + 1, user.MAX_ACCOUNT_LOCK_LEVEL);
                user.lockAccountWithLevel(nextLevel);
                
                String lockDuration = user.isPermanentlyLocked() 
                    ? "PERMANENT (requires admin unlock)"
                    : "for " + (nextLevel > 0 ? getAccountLockDurationMinutes(nextLevel) : lockoutDurationMinutes) + " minutes";
                log.warn("Account locked (Level {}) {} due to too many failed attempts: {}", 
                    nextLevel, lockDuration, accountId);
            }
        }

        userRepository.save(user);
    }
    
    /**
     * Get lockout duration in minutes for a given lock level.
     */
    private int getAccountLockDurationMinutes(int level) {
        if (level <= 0) return lockoutDurationMinutes;
        if (level >= 6) return 1440; // 24 hours
        int[] durations = {5, 30, 120, 360, 720, 1440};
        return durations[level - 1];
    }

    /**
     * Check if user account is valid for login
     */
    public void validateAccountStatus(User user) {
        if (user.getDeletedAt() != null) {
            throw new IllegalStateException("Account has been deleted and cannot be used for login");
        }

        if (!user.getAccountEnabled()) {
            throw new IllegalStateException("Account is disabled");
        }

        if (user.isAccountLocked()) {
            Integer minutesRemaining = null;
            String message;
            
            if (user.isPermanentlyLocked()) {
                message = "Account is permanently locked due to excessive failed login attempts. Please contact administrator.";
            } else if (user.getAccountLockedUntil() != null) {
                long seconds = java.time.Duration.between(LocalDateTime.now(), user.getAccountLockedUntil()).getSeconds();
                minutesRemaining = (int) Math.max(1, Math.ceil(seconds / 60.0));
                message = String.format("Account is locked. Please try again in %d minutes", minutesRemaining);
            } else {
                message = "Account is locked. Please try again later";
            }
            
            throw new AccountLockedException(message, minutesRemaining);
        }
    }

    /**
     * Record an MFA verification failure during login. Locks the account after too many failures.
     *
     * @return remaining attempts before lockout (if not locked yet)
     */
    @Transactional
    public int recordMfaLoginFailure(String accountId) {
        User user = userRepository.findByAccountId(accountId).orElse(null);
        if (user == null) return 0;

        Integer cur = user.getMfaLoginAttempts() == null ? 0 : user.getMfaLoginAttempts();
        int next = cur + 1;
        user.setMfaLoginAttempts(next);

        int remaining = Math.max(0, mfaMaxLoginAttempts - next);
        if (remaining <= 0) {
            // Lock account for MFA-specific duration, and reset MFA attempt counter for next window.
            user.setMfaLoginAttempts(0);
            user.lockAccount(mfaLockoutMinutes);
            userRepository.save(user);
            throw new AccountLockedException(
                "Too many invalid MFA codes. Account locked.",
                mfaLockoutMinutes
            );
        }

        userRepository.save(user);
        return remaining;
    }

    @Transactional
    public void resetMfaLoginAttempts(String accountId) {
        User user = userRepository.findByAccountId(accountId).orElse(null);
        if (user == null) return;
        user.setMfaLoginAttempts(0);
        userRepository.save(user);
    }

    /**
     * Update user last login time
     */
    @Transactional
    public void updateLastLogin(Long userId) {
        User user = findById(userId);
        user.setLastLoginAt(LocalDateTime.now());
        userRepository.save(user);
    }

    /**
     * Unlock user account (admin action to unlock permanently locked accounts)
     */
    @Transactional
    public void unlockAccount(Long userId) {
        log.info("Unlocking account for user ID: {}", userId);
        User user = findById(userId);
        user.resetLoginAttempts();
        user.setAccountLockLevel(0); // Reset lock level
        user.setMfaLoginAttempts(0);
        userRepository.save(user);
        log.info("Account unlocked successfully for user: {}", user.getAccountId());
    }

    /**
     * Disable user account (for brute force protection or manual admin action)
     * Admin accounts are EXCLUDED from disable (UEBA score must remain 100).
     * @param userId User ID
     * @param reason Reason for disabling (optional, can be null for manual admin action)
     */
    @Transactional
    public void disableAccount(Long userId, String reason) {
        User user = findById(userId);

        // Admin accounts are protected: UEBA score must remain 100
        if (hasAdminRole(user)) {
            log.warn("Attempted to disable admin account {} - operation blocked", user.getAccountId());
            throw new IllegalArgumentException("Admin account cannot be disabled (UEBA score must remain 100)");
        }

        user.setAccountEnabled(false);
        userRepository.save(user);
        if (reason != null && !reason.isEmpty()) {
            log.info("Account disabled for user: {} - Reason: {}", user.getAccountId(), reason);
        } else {
            log.info("Account disabled for user: {} by administrator", user.getAccountId());
        }
    }

    /**
     * Enable user account
     */
    @Transactional
    public void enableAccount(Long userId) {
        log.info("Enabling account for user ID: {}", userId);
        User user = findById(userId);
        user.setAccountEnabled(true);
        user.setAccountLocked(false);
        user.setAccountLockedUntil(null);
        user.setAccountLockLevel(0); // Reset lock level
        user.setLoginAttempts(0);
        userRepository.save(user);
        log.info("Account enabled successfully for user: {}", user.getAccountId());
    }

    /**
     * Deactivate user account (soft delete)
     * FR-007: Account status management
     * User account is disabled, cannot login, but data remains accessible
     */
    @Transactional
    public void deactivateUser(Long userId) {
        log.info("Deactivating user ID: {}", userId);
        User user = findById(userId);

        // Prevent deactivating the last admin
        if (user.getRoles().contains("ADMIN")) {
            long activeAdminCount = userRepository.findAll().stream()
                    .filter(u -> u.getAccountEnabled() && u.getRoles().contains("ADMIN"))
                    .count();
            if (activeAdminCount <= 1) {
                throw new IllegalStateException("Cannot deactivate the last active admin account");
            }
        }

        user.setAccountEnabled(false);
        userRepository.save(user);
        log.info("Account deactivated successfully for user: {}", user.getAccountId());
    }

    /**
     * Archive and logically delete user account.
     * Requires the account to be disabled first to avoid accidental deletion.
     * Documents are reassigned to an archive identity; original user remains in DB for FK safety.
     */
    @Transactional
    public void hardDeleteUser(Long userId) {
        log.info("Archive (logical delete) request for user ID: {}", userId);
        User user = findById(userId);

        if (user.getAccountEnabled()) {
            throw new IllegalStateException("User must be disabled before deletion");
        }

        // Prevent deleting the last active admin in the system (even if disabled)
        if (user.getRoles().contains("ADMIN")) {
            long adminCount = userRepository.findAll().stream()
                    .filter(u -> u.getRoles().contains("ADMIN"))
                    .count();
            if (adminCount <= 1) {
                throw new IllegalStateException("Cannot delete the last admin account");
            }
        }

        // If user still owns documents, reassign them to a dedicated archive identity
        Long ownedDocCount = documentRepository.countByOwner(user);
        if (ownedDocCount != null && ownedDocCount > 0) {
            log.info("User {} owns {} document(s) - reassigning to archive identity before deletion",
                    user.getAccountId(), ownedDocCount);
            User archiveUser = getOrCreateArchiveUser(user);
            documentRepository.reassignOwner(user, archiveUser);
            log.info("Reassigned {} document(s) from {} to archive identity {}",
                    ownedDocCount, user.getAccountId(), archiveUser.getAccountId());
        }

        // Keep original user row for referential integrity, but ensure it is fully disabled
        user.setAccountEnabled(false);
        user.setAccountLocked(true);
        user.setAccountLockedUntil(null);
        user.setMfaEnabled(false);
        user.setMfaSecret(null);
        user.setDeletedAt(LocalDateTime.now());
        userRepository.save(user);
        recordAccountIdIfMissing(user.getAccountId(), "USER_ARCHIVED");
        log.info("User account logically deleted (archived) for user: {}", user.getAccountId());
    }

    /**
     * Permanently delete (purge) a logically deleted user account.
     *
     * Important: many tables reference users via non-null FKs (activities, upload jobs, versions, signatures).
     * We must reassign these references to the user's archive identity first, then delete the user row.
     */
    @Transactional
    public void purgeDeletedUser(Long userId) {
        log.info("Purge (hard delete) request for user ID: {}", userId);
        User user = findById(userId);

        if (user.getAccountId() != null && user.getAccountId().startsWith("archived_")) {
            throw new IllegalStateException("Archive identities cannot be purged via this endpoint");
        }

        if (user.getDeletedAt() == null) {
            throw new IllegalStateException("User must be logically deleted before purge");
        }

        // Prevent deleting the last admin identity from the system
        if (user.getRoles().contains("ADMIN")) {
            long adminCount = userRepository.findAll().stream()
                    .filter(u -> u.getRoles().contains("ADMIN"))
                    .count();
            if (adminCount <= 1) {
                throw new IllegalStateException("Cannot purge the last admin account");
            }
        }

        User archiveUser = getOrCreateArchiveUser(user);

        // Reassign any remaining ownership / references to keep referential integrity intact
        documentRepository.reassignOwner(user, archiveUser);
        documentActivityRepository.reassignUser(user, archiveUser);
        uploadJobRepository.reassignUser(user, archiveUser);
        documentVersionRepository.reassignCreatedBy(user, archiveUser);
        signatureRepository.reassignSigner(user.getId(), archiveUser.getId());

        // Now safe to delete the user row
        recordAccountIdIfMissing(user.getAccountId(), "USER_PURGED");
        userRepository.delete(user);
        log.info("User purged successfully: {} (ID: {})", user.getAccountId(), user.getId());
    }

    /**
     * Batch delete all users with a specific role (excluding admin account)
     */
    @Transactional
    public int batchDeleteUsersWithRole(String role) {
        log.info("Batch deleting users with role: {}", role);
        
        // Find all users with the specified role
        List<User> usersToDelete = userRepository.findByRole(role);
        
        // Filter out admin account and already deleted users
        List<User> eligibleUsers = usersToDelete.stream()
                .filter(u -> !"admin".equalsIgnoreCase(u.getAccountId()))
                .filter(u -> u.getDeletedAt() == null)
                .collect(java.util.stream.Collectors.toList());
        
        if (eligibleUsers.isEmpty()) {
            log.info("No eligible users found with role: {}", role);
            return 0;
        }
        
        log.info("Found {} eligible users to delete with role: {}", eligibleUsers.size(), role);
        
        int deletedCount = 0;
        for (User user : eligibleUsers) {
            try {
                // Disable first if not already disabled
                if (user.getAccountEnabled()) {
                    user.setAccountEnabled(false);
                    userRepository.save(user);
                }
                
                // Then logically delete
                hardDeleteUser(user.getId());
                deletedCount++;
                log.info("Deleted user: {} (ID: {})", user.getAccountId(), user.getId());
            } catch (Exception e) {
                log.error("Failed to delete user {}: {}", user.getAccountId(), e.getMessage(), e);
                // Continue with next user
            }
        }
        
        log.info("Batch deletion completed. Deleted {} out of {} eligible users", deletedCount, eligibleUsers.size());
        return deletedCount;
    }

    /**
     * Restore logically deleted user within 30 days.
     */
    @Transactional
    public void restoreUser(Long userId) {
        log.info("Restore user request for user ID: {}", userId);
        User user = findById(userId);

        if (user.getDeletedAt() == null) {
            throw new IllegalStateException("User is not deleted");
        }

        LocalDateTime now = LocalDateTime.now();
        if (user.getDeletedAt().plusDays(30).isBefore(now)) {
            throw new IllegalStateException("User deletion can only be reversed within 30 days");
        }

        // Restore account to disabled but unlockable state; admin can explicitly enable later
        user.setDeletedAt(null);
        user.setAccountLocked(false);
        user.setAccountLockedUntil(null);
        user.setLoginAttempts(0);
        // Keep accountEnabled=false; admin must enable explicitly if needed
        userRepository.save(user);
        log.info("User account restored (still disabled) for user: {}", user.getAccountId());
    }

    /**
     * Create or reuse an archive identity for a departing user.
     * This identity cannot login and is used solely for document ownership retention.
     */
    private User getOrCreateArchiveUser(User sourceUser) {
        String archiveAccountId = "archived_" + sourceUser.getAccountId() + "_" + sourceUser.getId();

        return userRepository.findByAccountId(archiveAccountId)
                .orElseGet(() -> {
                    // Derive a non-conflicting archive email (domain from original if possible)
                    String archiveEmail;
                    String originalEmail = sourceUser.getEmail();
                    int atIndex = originalEmail.indexOf('@');
                    if (atIndex > 0) {
                        String localPart = originalEmail.substring(0, atIndex);
                        String domainPart = originalEmail.substring(atIndex + 1);
                        archiveEmail = localPart + "+archived_" + sourceUser.getId() + "@" + domainPart;
                    } else {
                        archiveEmail = sourceUser.getAccountId() + "+archived_" + sourceUser.getId() + "@archived.local";
                    }

                    // Generate a random password (will never be used for login)
                    String randomPassword = passwordUtil.generateSecurePassword(24);
                    String hashedPassword = passwordUtil.hashPassword(randomPassword);

                    User archive = User.builder()
                            .accountId(archiveAccountId)
                            .email(archiveEmail)
                            .hashedPassword(hashedPassword)
                            .fullName(sourceUser.getFullName() + " (Former employee)")
                            .department(sourceUser.getDepartment())
                            .position(sourceUser.getPosition())
                            .roles(new HashSet<>(sourceUser.getRoles()))
                            .mfaEnabled(false)
                            .mfaSecret(null)
                            .firstLogin(false)
                            .passwordChangeRequired(false)
                            .passwordChangedAt(LocalDateTime.now())
                            .passwordExpiryDate(null)
                            .passwordHistory(new ArrayList<>())
                            .accountLocked(false)
                            .accountLockedUntil(null)
                            .loginAttempts(0)
                            .accountEnabled(false) // cannot login; archival only
                            .systemAccount(true)
                            .tokenVersion(1)
                            .build();

                    User saved = userRepository.save(archive);
                    log.info("Created archive identity {} for departed user {}", saved.getAccountId(), sourceUser.getAccountId());
                    return saved;
                });
    }

    private void recordAccountIdIfMissing(String accountId, String reason) {
        if (accountId == null || accountId.isBlank()) return;
        if (accountIdHistoryRepository.existsByAccountId(accountId)) return;
        try {
            accountIdHistoryRepository.save(AccountIdHistory.builder()
                .accountId(accountId)
                .reason(reason)
                .build());
        } catch (Exception ignored) {
            // best-effort; avoid failing core flows due to history record collisions
        }
    }

    /**
     * Reset user password (Admin only)
     * Generates a temporary password and forces user to change on next login
     * Returns UserCreationResult with temporary password for secure communication
     */
    @Transactional
    public UserCreationResult resetPassword(Long userId) {
        log.info("Resetting password for user ID: {}", userId);
        User user = findById(userId);

        // Generate secure temporary password
        String temporaryPassword = passwordUtil.generateSecurePassword(12);

        // Hash the password
        String hashedPassword = passwordUtil.hashPassword(temporaryPassword);

        // Update password history
        List<String> updatedHistory = passwordUtil.updatePasswordHistory(
                user.getPasswordHistory(),
                user.getHashedPassword()
        );

        // Update user with temporary password
        user.setHashedPassword(hashedPassword);
        user.setPasswordHistory(updatedHistory);
        user.setPasswordChangedAt(LocalDateTime.now());
        user.setPasswordExpiryDate(LocalDateTime.now().plusDays(passwordExpiryDays));
        user.setPasswordChangeRequired(true);
        user.setFirstLogin(false);

        // SECURITY: Disable MFA - force user to re-setup after password reset
        // This prevents compromised accounts from retaining MFA access
        user.setMfaEnabled(false);
        user.setMfaSecret(null);
        user.setMfaLoginAttempts(0);

        // Reset login attempts and unlock account if locked.
        // Also re-enable account so reset users can login with temporary password immediately.
        user.resetLoginAttempts();
        user.setAccountEnabled(true);

        userRepository.save(user);
        log.info("Password reset successfully for user: {} (MFA disabled, password change required, account enabled)", user.getAccountId());

        // Return DTO with temporary password - NEVER store plaintext in entity
        return UserCreationResult.builder()
                .userId(user.getId())
                .accountId(user.getAccountId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .initialPassword(temporaryPassword)
                .build();
    }

    /**
     * Update user profile (self-service, limited fields)
     * Users can only update email and fullName
     * Roles, department require admin modification
     */
    @Transactional
    public UserResponse updateUserProfile(Long userId, String newEmail, String newFullName) {
        log.info("Updating profile for user ID: {}", userId);
        User user = findById(userId);

        // Check if email is changing and if new email already exists
        if (!user.getEmail().equals(newEmail)) {
            if (userRepository.existsByEmail(newEmail)) {
                throw new IllegalArgumentException("User already exists with this email: " + newEmail);
            }
            user.setEmail(newEmail);
        }

        // Update full name
        user.setFullName(newFullName);

        User updatedUser = userRepository.save(user);
        log.info("Profile updated successfully for user: {}", updatedUser.getAccountId());

        return convertToResponse(updatedUser);
    }

    /**
     * Update user's own profile (limited fields: email, fullName)
     *
     * @param currentUser The authenticated user
     * @param request Update request with email and fullName
     * @param ipAddress Client IP address for audit
     * @return Updated profile response
     * @throws IllegalArgumentException if email already exists (different user)
     */
    @Transactional
    public UserProfileResponse updateProfile(User currentUser, UpdateProfileRequest request, String ipAddress) {
        log.info("User {} updating own profile", currentUser.getAccountId());

        // Validate email uniqueness (if changed)
        if (!currentUser.getEmail().equals(request.getEmail())) {
            if (userRepository.findByEmail(request.getEmail()).isPresent()) {
                throw new IllegalArgumentException("User already exists with this email");
            }
        }

        // Update allowed fields only
        currentUser.setEmail(request.getEmail());
        currentUser.setFullName(request.getFullName());

        User savedUser = userRepository.save(currentUser);

        // Audit log
        auditLogService.log(
            currentUser.getId(),
            "PROFILE_UPDATED",
            "User",
            currentUser.getId().toString(),
            ipAddress,
            "User updated profile: email=" + request.getEmail() + ", fullName=" + request.getFullName()
        );

        log.info("Profile updated successfully for user {}", currentUser.getAccountId());
        return UserProfileResponse.from(savedUser);
    }

    /**
     * Convert User entity to UserResponse DTO
     */
    private UserResponse convertToResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .accountId(user.getAccountId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .department(user.getDepartment())
                .roles(user.getRoles())
                .mfaEnabled(user.getMfaEnabled())
                .accountEnabled(user.getAccountEnabled())
                .accountLocked(user.getAccountLocked())
                .lastLoginAt(user.getLastLoginAt())
                .passwordExpiryDate(user.getPasswordExpiryDate())
                .createdAt(user.getCreatedAt())
                .deletedAt(user.getDeletedAt())
                .build();
    }
}
