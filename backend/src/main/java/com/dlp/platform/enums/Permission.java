package com.dlp.platform.enums;

/**
 * Granular permissions in the system (FR-004, SR-008)
 * Used for fine-grained access control at document and operation level
 */
public enum Permission {
    // User Management Permissions
    CREATE_USER("Create user accounts"),
    READ_USER("View user profiles"),
    UPDATE_USER("Update user information"),
    DELETE_USER("Deactivate user accounts"),
    RESET_PASSWORD("Reset user passwords"),
    MANAGE_ROLES("Assign and modify user roles"),

    // Document Permissions
    READ_DOCUMENT("View documents"),
    WRITE_DOCUMENT("Create and edit documents"),
    DELETE_DOCUMENT("Delete documents"),
    DOWNLOAD_DOCUMENT("Download documents"),
    UPLOAD_DOCUMENT("Upload documents"),
    SHARE_DOCUMENT("Share documents with others"),
    CLASSIFY_DOCUMENT("Classify document sensitivity level"),
    OVERRIDE_CLASSIFICATION("Override document classification level"),

    // Approval & Workflow Permissions
    CREATE_TASK("Create approval tasks"),
    READ_TASK("View tasks"),
    APPROVE_TASK("Approve tasks"),
    REJECT_TASK("Reject tasks"),
    ASSIGN_TASK("Assign tasks to others"),

    // Audit & Monitoring Permissions
    VIEW_AUDIT_LOGS("View audit logs"),
    EXPORT_AUDIT_LOGS("Export audit logs"),
    VIEW_OWN_ACTIVITY("View own activity history"),
    VIEW_TEAM_ACTIVITY("View team member activity"),
    VIEW_ALL_ACTIVITY("View all user activity"),

    // Security & Compliance Permissions
    VIEW_EDR_CONSOLE("Access EDR console"),
    INVESTIGATE_INCIDENTS("Investigate security incidents"),
    VIEW_POLICY_VIOLATIONS("View policy violations"),
    GENERATE_COMPLIANCE_REPORTS("Generate compliance reports"),
    VIEW_CLASSIFICATION_REPORTS("View document classification reports"),

    // System Administration Permissions
    MANAGE_SYSTEM_CONFIG("Manage system configuration"),
    VIEW_SYSTEM_HEALTH("View system health metrics"),
    VIEW_JOB_QUEUE("View background job queue"),
    MANAGE_DEPARTMENTS("Manage organizational hierarchy"),
    VIEW_SYSTEM_LOGS("View system logs"),
    EXPORT_SYSTEM_LOGS("Export system logs"),

    // Dashboard Permissions
    ACCESS_ADMIN_DASHBOARD("Access administrator dashboard"),
    ACCESS_MANAGER_DASHBOARD("Access manager dashboard"),
    ACCESS_SECURITY_DASHBOARD("Access security dashboard (admin only)"),
    ACCESS_UEBA_DASHBOARD("Access UEBA dashboard (admin only)"),
    ACCESS_COMPLIANCE_DASHBOARD("Access compliance officer dashboard");

    private final String description;

    Permission(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }

    /**
     * Check if this is a read-only permission
     */
    public boolean isReadOnly() {
        String name = this.name();
        return name.startsWith("READ_") || name.startsWith("VIEW_") || name.startsWith("ACCESS_");
    }

    /**
     * Check if this is a write/modify permission
     */
    public boolean isWritePermission() {
        String name = this.name();
        return name.startsWith("CREATE_") || name.startsWith("UPDATE_") ||
               name.startsWith("DELETE_") || name.startsWith("WRITE_") ||
               name.startsWith("UPLOAD_") || name.startsWith("MANAGE_");
    }

    /**
     * Check if this is a sensitive permission requiring extra validation
     */
    public boolean isSensitive() {
        return this == DELETE_USER || this == RESET_PASSWORD || this == MANAGE_ROLES ||
               this == DELETE_DOCUMENT || this == EXPORT_AUDIT_LOGS ||
               this == MANAGE_SYSTEM_CONFIG || this == EXPORT_SYSTEM_LOGS;
    }
}
