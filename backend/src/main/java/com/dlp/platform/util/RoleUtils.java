package com.dlp.platform.util;

import java.util.Locale;
import java.util.Set;

/**
 * Role utilities.
 *
 * IMPORTANT:
 * - In DB and in User.roles we store roles WITHOUT the "ROLE_" prefix (e.g., "ADMIN").
 * - Spring Security authorities are derived as "ROLE_" + role (see UserDetailsServiceImpl).
 * - Legacy data may still contain values like "ROLE_ADMIN" or "USER".
 */
public final class RoleUtils {

    private RoleUtils() {}

    public static String normalize(String role) {
        if (role == null) return "";
        String r = role.trim().toUpperCase(Locale.ROOT);
        if (r.startsWith("ROLE_")) r = r.substring("ROLE_".length());
        if ("USER".equals(r)) r = "EMPLOYEE";
        return r;
    }

    public static boolean hasRole(Set<String> roles, String requiredRole) {
        if (roles == null || roles.isEmpty()) return false;
        String required = normalize(requiredRole);
        for (String r : roles) {
            if (required.equals(normalize(r))) return true;
        }
        return false;
    }

    public static boolean isAdmin(Set<String> roles) {
        return hasRole(roles, "ADMIN");
    }
}

















