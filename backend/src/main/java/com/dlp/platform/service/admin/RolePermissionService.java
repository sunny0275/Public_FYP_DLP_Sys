package com.dlp.platform.service.admin;

import com.dlp.platform.enums.Permission;
import com.dlp.platform.enums.Role;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for managing role-to-permission mappings
 * Implements the permission model from Phase 01 Section 1.2.2
 *
 * Only 4 roles are used: ADMIN, MANAGER, REVIEWER, EMPLOYEE
 */
@Service
public class RolePermissionService {

    private static final Map<Role, Set<Permission>> ROLE_PERMISSIONS = new HashMap<>();

    static {
        // ADMIN - Full system access
        ROLE_PERMISSIONS.put(Role.ADMIN, Set.of(
                // User Management
                Permission.CREATE_USER,
                Permission.READ_USER,
                Permission.UPDATE_USER,
                Permission.DELETE_USER,
                Permission.RESET_PASSWORD,
                Permission.MANAGE_ROLES,

                // Documents - Full access
                Permission.READ_DOCUMENT,
                Permission.WRITE_DOCUMENT,
                Permission.DELETE_DOCUMENT,
                Permission.DOWNLOAD_DOCUMENT,
                Permission.UPLOAD_DOCUMENT,
                Permission.SHARE_DOCUMENT,
                Permission.CLASSIFY_DOCUMENT,

                // Tasks & Workflows
                Permission.CREATE_TASK,
                Permission.READ_TASK,
                Permission.APPROVE_TASK,
                Permission.REJECT_TASK,
                Permission.ASSIGN_TASK,

                // Audit & Monitoring
                Permission.VIEW_AUDIT_LOGS,
                Permission.EXPORT_AUDIT_LOGS,
                Permission.VIEW_OWN_ACTIVITY,
                Permission.VIEW_TEAM_ACTIVITY,
                Permission.VIEW_ALL_ACTIVITY,

                // Security & Compliance
                Permission.VIEW_EDR_CONSOLE,
                Permission.INVESTIGATE_INCIDENTS,
                Permission.VIEW_POLICY_VIOLATIONS,
                Permission.GENERATE_COMPLIANCE_REPORTS,
                Permission.VIEW_CLASSIFICATION_REPORTS,

                // System Administration
                Permission.MANAGE_SYSTEM_CONFIG,
                Permission.VIEW_SYSTEM_HEALTH,
                Permission.VIEW_JOB_QUEUE,
                Permission.MANAGE_DEPARTMENTS,
                Permission.VIEW_SYSTEM_LOGS,
                Permission.EXPORT_SYSTEM_LOGS,

                // Dashboards (all access)
                Permission.ACCESS_ADMIN_DASHBOARD,
                Permission.ACCESS_MANAGER_DASHBOARD,
                Permission.ACCESS_SECURITY_DASHBOARD,
                Permission.ACCESS_UEBA_DASHBOARD,
                Permission.ACCESS_COMPLIANCE_DASHBOARD
        ));

        // MANAGER - Department management and share approval
        ROLE_PERMISSIONS.put(Role.MANAGER, Set.of(
                Permission.READ_USER,

                // Documents - Department level access
                Permission.READ_DOCUMENT,
                Permission.WRITE_DOCUMENT,
                Permission.DELETE_DOCUMENT,
                Permission.DOWNLOAD_DOCUMENT,
                Permission.UPLOAD_DOCUMENT,
                Permission.SHARE_DOCUMENT,
                Permission.CLASSIFY_DOCUMENT,

                // Tasks & Workflows - Department approval
                Permission.CREATE_TASK,
                Permission.READ_TASK,
                Permission.APPROVE_TASK,
                Permission.REJECT_TASK,
                Permission.ASSIGN_TASK,

                // Audit & Monitoring - Team level
                Permission.VIEW_AUDIT_LOGS,
                Permission.VIEW_OWN_ACTIVITY,
                Permission.VIEW_TEAM_ACTIVITY,

                // Security
                Permission.VIEW_EDR_CONSOLE,
                Permission.INVESTIGATE_INCIDENTS,
                Permission.VIEW_POLICY_VIOLATIONS,

                // Dashboards
                Permission.ACCESS_MANAGER_DASHBOARD
        ));

        // REVIEWER - Classification review and approval
        ROLE_PERMISSIONS.put(Role.REVIEWER, Set.of(
                Permission.READ_USER,

                // Documents - Can read documents in REVIEW_REQUIRED status
                Permission.READ_DOCUMENT,
                Permission.DOWNLOAD_DOCUMENT,
                Permission.WRITE_DOCUMENT, // For classification level updates

                // Classification Review
                Permission.VIEW_CLASSIFICATION_REPORTS,
                Permission.OVERRIDE_CLASSIFICATION,

                // Audit
                Permission.VIEW_AUDIT_LOGS,
                Permission.VIEW_OWN_ACTIVITY,

                // Dashboards
                Permission.ACCESS_COMPLIANCE_DASHBOARD
        ));

        // EMPLOYEE - Basic access
        ROLE_PERMISSIONS.put(Role.EMPLOYEE, Set.of(
                // Documents - Own documents only
                Permission.READ_DOCUMENT,
                Permission.WRITE_DOCUMENT,
                Permission.DOWNLOAD_DOCUMENT,
                Permission.UPLOAD_DOCUMENT,
                Permission.SHARE_DOCUMENT,

                // Tasks & Workflows - Create and view
                Permission.CREATE_TASK,
                Permission.READ_TASK,

                // Audit & Monitoring - Own activity only
                Permission.VIEW_OWN_ACTIVITY
        ));
    }

    /**
     * Get all permissions for a specific role
     */
    public Set<Permission> getPermissionsForRole(Role role) {
        return Collections.unmodifiableSet(ROLE_PERMISSIONS.getOrDefault(role, Collections.emptySet()));
    }

    /**
     * Get all permissions for a user with multiple roles
     * Returns union of all role permissions
     */
    public Set<Permission> getPermissionsForRoles(Set<Role> roles) {
        Set<Permission> allPermissions = new HashSet<>();
        for (Role role : roles) {
            allPermissions.addAll(getPermissionsForRole(role));
        }
        return Collections.unmodifiableSet(allPermissions);
    }

    /**
     * Check if a role has a specific permission
     */
    public boolean hasPermission(Role role, Permission permission) {
        Set<Permission> permissions = ROLE_PERMISSIONS.get(role);
        return permissions != null && permissions.contains(permission);
    }

    /**
     * Check if any of the user's roles has a specific permission
     */
    public boolean hasPermission(Set<Role> roles, Permission permission) {
        return roles.stream()
                .anyMatch(role -> hasPermission(role, permission));
    }

    /**
     * Get all dashboards a user can access based on their roles
     */
    public Set<String> getAvailableDashboards(Set<Role> roles) {
        Set<String> dashboards = new HashSet<>();
        Set<Permission> permissions = getPermissionsForRoles(roles);

        // Everyone gets base dashboard
        dashboards.add("dashboard");

        // Add specialized dashboards based on permissions
        if (permissions.contains(Permission.ACCESS_ADMIN_DASHBOARD)) {
            dashboards.add("dashboard/admin");
        }
        if (permissions.contains(Permission.ACCESS_MANAGER_DASHBOARD)) {
            dashboards.add("dashboard/manager");
        }
        if (permissions.contains(Permission.ACCESS_SECURITY_DASHBOARD)) {
            dashboards.add("dashboard/security");
        }
        if (permissions.contains(Permission.ACCESS_UEBA_DASHBOARD)) {
            dashboards.add("ueba");
        }
        if (permissions.contains(Permission.ACCESS_COMPLIANCE_DASHBOARD)) {
            dashboards.add("dashboard/compliance");
        }

        return Collections.unmodifiableSet(dashboards);
    }

    /**
     * Get all dashboards a user can access based on their roles (string version)
     * Convenience method for working with string-based roles from database
     */
    public Set<String> getAvailableDashboardsFromStrings(Set<String> roleStrings) {
        Set<Role> roles = roleStrings.stream()
                .map(roleStr -> {
                    try {
                        return Role.valueOf(roleStr);
                    } catch (IllegalArgumentException e) {
                        // If role string doesn't match enum, log warning and skip
                        return null;
                    }
                })
                .filter(role -> role != null)
                .collect(Collectors.toSet());

        return getAvailableDashboards(roles);
    }

    /**
     * Get union permissions from string-based roles (as stored in DB).
     */
    public Set<Permission> getPermissionsFromStrings(Set<String> roleStrings) {
        if (roleStrings == null || roleStrings.isEmpty()) {
            return Collections.emptySet();
        }
        Set<Role> roles = roleStrings.stream()
            .map(roleStr -> {
                try {
                    return Role.valueOf(roleStr);
                } catch (IllegalArgumentException e) {
                    return null;
                }
            })
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());

        return getPermissionsForRoles(roles);
    }

    public boolean hasPermissionFromStrings(Set<String> roleStrings, Permission permission) {
        return getPermissionsFromStrings(roleStrings).contains(permission);
    }

    /**
     * Get highest role from a set of roles (based on hierarchy level)
     */
    public Role getHighestRole(Set<Role> roles) {
        return roles.stream()
                .max(Comparator.comparingInt(Role::getHierarchyLevel))
                .orElse(Role.EMPLOYEE);
    }
}
