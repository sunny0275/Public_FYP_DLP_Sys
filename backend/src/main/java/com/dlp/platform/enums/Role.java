package com.dlp.platform.enums;

/**
 * Predefined roles in the system (FR-003)
 *
 * Only 4 roles are used:
 * - ADMIN: System Administrator - Full system access
 * - MANAGER: Department Manager - Can approve shares, manage documents
 * - REVIEWER: Classification Reviewer - Reviews and approves document classifications
 * - EMPLOYEE: Standard Employee - Basic document access
 */
public enum Role {
    /**
     * System Administrator - Full system access, user management, system configuration
     * Bypasses ABAC rules, can access all departments and resources
     */
    ADMIN("System Administrator"),

    /**
     * Standard Employee - Basic document access
     */
    EMPLOYEE("Employee"),

    /**
     * Classification Reviewer - Reviews and approves document classification levels
     * Can access documents in REVIEW_REQUIRED status for classification review
     */
    REVIEWER("Classification Reviewer"),

    /**
     * Department Manager - Department documents (read/write), share approval authority
     * Can access own department, can approve pending shares
     */
    MANAGER("Manager");

    private final String displayName;

    Role(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }

    /**
     * Check if this role has administrative privileges
     */
    public boolean isAdmin() {
        return this == ADMIN;
    }

    /**
     * Check if this role has cross-departmental access
     */
    public boolean hasCrossDepartmentalAccess() {
        return this == ADMIN;
    }

    /**
     * Check if this role has management privileges
     */
    public boolean isManagement() {
        return this == MANAGER;
    }

    /**
     * Get role hierarchy level (higher number = more privilege)
     */
    public int getHierarchyLevel() {
        return switch (this) {
            case ADMIN -> 4;
            case MANAGER -> 3;
            case REVIEWER -> 2;
            case EMPLOYEE -> 1;
        };
    }

    /**
     * Check if this role has higher or equal privilege than another role
     */
    public boolean hasHigherOrEqualPrivilege(Role other) {
        return this.getHierarchyLevel() >= other.getHierarchyLevel();
    }
}
