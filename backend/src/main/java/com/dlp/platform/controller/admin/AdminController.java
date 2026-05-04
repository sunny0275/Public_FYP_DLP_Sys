package com.dlp.platform.controller.admin;

import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.dto.user.CreateUserRequest;
import com.dlp.platform.dto.user.UpdateUserRequest;
import com.dlp.platform.dto.user.UserCreationResult;
import com.dlp.platform.dto.user.UserResponse;
import com.dlp.platform.entity.User;
import com.dlp.platform.security.UserDetailsServiceImpl;
import com.dlp.platform.entity.PasswordResetRequest;
import com.dlp.platform.service.audit.AuditService;
import com.dlp.platform.service.admin.IpLoginAttemptService;
import com.dlp.platform.service.admin.PasswordResetRequestService;
import com.dlp.platform.service.admin.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final UserService userService;
    private final AuditService auditService;
    private final IpLoginAttemptService ipLoginAttemptService;
    private final PasswordResetRequestService passwordResetRequestService;

    /**
     * POST /api/admin/users - Create new user
     */
    @PostMapping("/users")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createUser(
            @Valid @RequestBody CreateUserRequest request,
            HttpServletRequest httpRequest
    ) {
        log.info("Create user request for account: {}", request.getAccountId());

        try {
            // Create user
            UserCreationResult createdUser = userService.createUser(request);

            // Get admin user info for audit log
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            UserDetailsServiceImpl.CustomUserDetails adminDetails =
                    (UserDetailsServiceImpl.CustomUserDetails) authentication.getPrincipal();

            // Log user creation
            auditService.logUserCreation(
                    adminDetails.getUserId(),
                    adminDetails.getAccountId(),
                    createdUser.getAccountId(),
                    httpRequest
            );

            // Prepare response with initial password for ONE-TIME DISPLAY
            // Password shown once in admin UI, not persisted in logs or database
            Map<String, Object> responseData = new HashMap<>();
            responseData.put("userId", createdUser.getUserId());
            responseData.put("accountId", createdUser.getAccountId());
            responseData.put("email", createdUser.getEmail());
            responseData.put("fullName", createdUser.getFullName());
            responseData.put("initialPassword", createdUser.getInitialPassword()); // One-time display only
            responseData.put("message", "User created successfully. IMPORTANT: Save this password - it will only be shown once.");

            return ResponseEntity.ok(ApiResponse.success("User created successfully", responseData));
        } catch (IllegalArgumentException e) {
            log.error("User creation failed: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("User creation failed", e.getMessage()));
        } catch (Exception e) {
            log.error("User creation error: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("Internal server error", e.getMessage()));
        }
    }

    /**
     * GET /api/admin/users - Get all users
     */
    @GetMapping("/users")
    public ResponseEntity<ApiResponse<List<UserResponse>>> getAllUsers() {
        try {
            List<UserResponse> users = userService.getAllUsers();
            return ResponseEntity.ok(ApiResponse.success(users));
        } catch (Exception e) {
            log.error("Get all users failed: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("Failed to retrieve users", e.getMessage()));
        }
    }

    /**
     * GET /api/admin/users/next-account-id?department=...&position=...
     * Preview next auto-generated accountId (for admin UI display).
     */
    @GetMapping("/users/next-account-id")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> getNextAccountId(
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String position) {
        try {
            // Convert position to roles set for preview (position maps to role)
            java.util.Set<String> roles = position != null && !position.isBlank() 
                ? java.util.Set.of(position) : java.util.Set.of();
            String accountId = userService.previewNextAccountId(department, roles);
            return ResponseEntity.ok(ApiResponse.success(java.util.Map.of("accountId", accountId)));
        } catch (Exception e) {
            log.error("Get next accountId failed: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("Failed to generate accountId", e.getMessage()));
        }
    }

    /**
     * GET /api/admin/users/{userId} - Get user by ID
     */
    @GetMapping("/users/{userId}")
    public ResponseEntity<ApiResponse<User>> getUserById(@PathVariable Long userId) {
        try {
            User user = userService.findById(userId);
            return ResponseEntity.ok(ApiResponse.success(user));
        } catch (Exception e) {
            log.error("Get user by ID failed: {}", e.getMessage());
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * PUT /api/admin/users/{userId} - Update user information
     */
    @PutMapping("/users/{userId}")
    public ResponseEntity<ApiResponse<UserResponse>> updateUser(
            @PathVariable Long userId,
            @Valid @RequestBody UpdateUserRequest request,
            HttpServletRequest httpRequest
    ) {
        log.info("Update user request for user ID: {}", userId);

        try {
            // Get user info before update for audit log
            User originalUser = userService.findById(userId);
            String accountId = originalUser.getAccountId();

            // Update user
            UserResponse updatedUser = userService.updateUser(userId, request);

            // Get admin user info for audit log
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            UserDetailsServiceImpl.CustomUserDetails adminDetails =
                    (UserDetailsServiceImpl.CustomUserDetails) authentication.getPrincipal();

            // Build change description
            StringBuilder changes = new StringBuilder("User updated: ");
            if (!originalUser.getEmail().equals(request.getEmail())) {
                changes.append("email=").append(request.getEmail()).append(" ");
            }
            if (!originalUser.getFullName().equals(request.getFullName())) {
                changes.append("name=").append(request.getFullName()).append(" ");
            }
            if (!originalUser.getDepartment().equals(request.getDepartment())) {
                changes.append("dept=").append(request.getDepartment()).append(" ");
            }
            if (request.getPosition() != null && !originalUser.getPosition().equals(request.getPosition())) {
                changes.append("position=").append(request.getPosition()).append(" ");
            }
            if (!originalUser.getRoles().equals(request.getRoles())) {
                changes.append("roles=").append(request.getRoles()).append(" ");
            }

            // Log user modification
            auditService.logUserModification(
                    adminDetails.getUserId(),
                    adminDetails.getAccountId(),
                    accountId,
                    changes.toString(),
                    httpRequest
            );

            return ResponseEntity.ok(ApiResponse.success("User updated successfully", updatedUser));
        } catch (IllegalArgumentException e) {
            log.error("User update failed: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("User update failed", e.getMessage()));
        } catch (Exception e) {
            log.error("User update error: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("Internal server error", e.getMessage()));
        }
    }

    /**
     * PUT /api/admin/users/{userId}/unlock - Unlock user account
     */
    @PutMapping("/users/{userId}/unlock")
    public ResponseEntity<ApiResponse<Void>> unlockAccount(
            @PathVariable Long userId,
            HttpServletRequest httpRequest
    ) {
        try {
            // Get user info before unlocking for audit log
            User user = userService.findById(userId);
            String accountId = user.getAccountId();

            // Unlock account (persists changes)
            userService.unlockAccount(userId);

            // Get admin user info for audit log
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            UserDetailsServiceImpl.CustomUserDetails adminDetails =
                    (UserDetailsServiceImpl.CustomUserDetails) authentication.getPrincipal();

            auditService.logUserModification(
                    adminDetails.getUserId(),
                    adminDetails.getAccountId(),
                    accountId,
                    "Account unlocked",
                    httpRequest
            );

            return ResponseEntity.ok(ApiResponse.success("Account unlocked successfully", null));
        } catch (Exception e) {
            log.error("Unlock account failed: {}", e.getMessage(), e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Failed to unlock account", e.getMessage()));
        }
    }

    /**
     * PUT /api/admin/users/{userId}/disable - Disable user account
     */
    @PutMapping("/users/{userId}/disable")
    public ResponseEntity<ApiResponse<Void>> disableAccount(
            @PathVariable Long userId,
            HttpServletRequest httpRequest
    ) {
        try {
            // Get user info before disabling for audit log
            User user = userService.findById(userId);
            String accountId = user.getAccountId();

            // Get admin user info for audit log
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            UserDetailsServiceImpl.CustomUserDetails adminDetails =
                    (UserDetailsServiceImpl.CustomUserDetails) authentication.getPrincipal();

            // Disable account (persists changes)
            userService.disableAccount(userId, "Disabled by admin: " + adminDetails.getAccountId());

            auditService.logUserModification(
                    adminDetails.getUserId(),
                    adminDetails.getAccountId(),
                    accountId,
                    "Account disabled",
                    httpRequest
            );

            return ResponseEntity.ok(ApiResponse.success("Account disabled successfully", null));
        } catch (Exception e) {
            log.error("Disable account failed: {}", e.getMessage(), e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Failed to disable account", e.getMessage()));
        }
    }

    /**
     * PUT /api/admin/users/{userId}/enable - Enable user account
     */
    @PutMapping("/users/{userId}/enable")
    public ResponseEntity<ApiResponse<Void>> enableAccount(
            @PathVariable Long userId,
            HttpServletRequest httpRequest
    ) {
        try {
            // Get user info before enabling for audit log
            User user = userService.findById(userId);
            String accountId = user.getAccountId();

            // Enable account (persists changes)
            userService.enableAccount(userId);

            // Get admin user info for audit log
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            UserDetailsServiceImpl.CustomUserDetails adminDetails =
                    (UserDetailsServiceImpl.CustomUserDetails) authentication.getPrincipal();

            auditService.logUserModification(
                    adminDetails.getUserId(),
                    adminDetails.getAccountId(),
                    accountId,
                    "Account enabled",
                    httpRequest
            );

            return ResponseEntity.ok(ApiResponse.success("Account enabled successfully", null));
        } catch (Exception e) {
            log.error("Enable account failed: {}", e.getMessage(), e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Failed to enable account", e.getMessage()));
        }
    }

    /**
     * POST /api/admin/ueba/reset-scores - Reset all UEBA scores to 100.
     * Optional: re-enable disabled users in the same operation.
     */
    @PostMapping("/ueba/reset-scores")
    public ResponseEntity<ApiResponse<Map<String, Object>>> resetUebaScores(
            @RequestParam(defaultValue = "false") boolean enableAccounts,
            HttpServletRequest httpRequest
    ) {
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            UserDetailsServiceImpl.CustomUserDetails adminDetails =
                    (UserDetailsServiceImpl.CustomUserDetails) authentication.getPrincipal();

            int updated = userService.resetAllUebaScores(enableAccounts);
            auditService.logUserModification(
                    adminDetails.getUserId(),
                    adminDetails.getAccountId(),
                    "UEBA",
                    "Reset UEBA scores to 100 for " + updated + " users" + (enableAccounts ? " (accounts re-enabled)" : ""),
                    httpRequest
            );

            Map<String, Object> response = new HashMap<>();
            response.put("updatedUsers", updated);
            response.put("enableAccounts", enableAccounts);
            return ResponseEntity.ok(ApiResponse.success("UEBA scores reset successfully", response));
        } catch (Exception e) {
            log.error("Failed to reset UEBA scores", e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Failed to reset UEBA scores", e.getMessage()));
        }
    }

    /**
     * POST /api/admin/users/{userId}/ueba/reset-score - Reset UEBA score for a single user.
     * Optional: re-enable the target user account in the same operation.
     */
    @PostMapping("/users/{userId}/ueba/reset-score")
    public ResponseEntity<ApiResponse<UserResponse>> resetSingleUserUebaScore(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "false") boolean enableAccount,
            HttpServletRequest httpRequest
    ) {
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            UserDetailsServiceImpl.CustomUserDetails adminDetails =
                    (UserDetailsServiceImpl.CustomUserDetails) authentication.getPrincipal();

            UserResponse updated = userService.resetUserUebaScore(userId, enableAccount);
            auditService.logUserModification(
                    adminDetails.getUserId(),
                    adminDetails.getAccountId(),
                    updated.getAccountId(),
                    "Reset UEBA score to 100" + (enableAccount ? " and re-enabled account" : ""),
                    httpRequest
            );

            return ResponseEntity.ok(ApiResponse.success("User UEBA score reset successfully", updated));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to reset user UEBA score for userId={}", userId, e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Failed to reset user UEBA score", e.getMessage()));
        }
    }

    /**
     * DELETE /api/admin/users/{userId} - Archive & logically delete user account
     * Requires the account to be disabled first.
     * Documents are reassigned to an archive identity; original user is fully disabled.
     */
    @DeleteMapping("/users/{userId}")
    public ResponseEntity<ApiResponse<Void>> deleteUser(
            @PathVariable Long userId,
            HttpServletRequest httpRequest
    ) {
        log.info("Delete user request for user ID: {}", userId);

        try {
            // Get admin user info for authorization check
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            UserDetailsServiceImpl.CustomUserDetails adminDetails =
                    (UserDetailsServiceImpl.CustomUserDetails) authentication.getPrincipal();

            // SECURITY: Prevent admins from deleting their own account
            if (adminDetails.getUserId().equals(userId)) {
                log.warn("Admin {} attempted to delete own account", adminDetails.getAccountId());
                return ResponseEntity.status(403)
                        .body(ApiResponse.error("Security violation", "You cannot delete your own account."));
            }

            // Get user info before deletion for audit log
            User user = userService.findById(userId);
            String accountId = user.getAccountId();

            // Archive & logically delete user (must already be disabled)
            userService.hardDeleteUser(userId);

            // Log user deletion
            auditService.logUserModification(
                    adminDetails.getUserId(),
                    adminDetails.getAccountId(),
                    accountId,
                    "Account archived (logical delete)",
                    httpRequest
            );

            return ResponseEntity.ok(ApiResponse.success("Account archived successfully", null));
        } catch (IllegalStateException e) {
            log.error("Deletion blocked: {}", e.getMessage());
            return ResponseEntity.status(403)
                    .body(ApiResponse.error("Deletion blocked", e.getMessage()));
        } catch (Exception e) {
            log.error("Delete account failed: {}", e.getMessage(), e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Failed to delete account", e.getMessage()));
        }
    }

    /**
     * DELETE /api/admin/users/{userId}/purge - Permanently delete a logically deleted user account
     * This is irreversible and should only be used from the Recovery Accounts page.
     * Documents and related references are reassigned to an archive identity before deletion.
     */
    @DeleteMapping("/users/{userId}/purge")
    public ResponseEntity<ApiResponse<Void>> purgeUser(
            @PathVariable Long userId,
            HttpServletRequest httpRequest
    ) {
        log.info("Purge user request for user ID: {}", userId);

        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            UserDetailsServiceImpl.CustomUserDetails adminDetails =
                    (UserDetailsServiceImpl.CustomUserDetails) authentication.getPrincipal();

            // SECURITY: Prevent admins from purging their own account
            if (adminDetails.getUserId().equals(userId)) {
                log.warn("Admin {} attempted to purge own account", adminDetails.getAccountId());
                return ResponseEntity.status(403)
                        .body(ApiResponse.error("Security violation", "You cannot purge your own account."));
            }

            // Get user info before purge for audit log
            User user = userService.findById(userId);
            String accountId = user.getAccountId();

            userService.purgeDeletedUser(userId);

            auditService.logUserModification(
                    adminDetails.getUserId(),
                    adminDetails.getAccountId(),
                    accountId,
                    "Account purged (hard delete)",
                    httpRequest
            );

            return ResponseEntity.ok(ApiResponse.success("Account permanently deleted", null));
        } catch (IllegalStateException e) {
            log.error("Purge blocked: {}", e.getMessage());
            return ResponseEntity.status(403)
                    .body(ApiResponse.error("Purge blocked", e.getMessage()));
        } catch (Exception e) {
            log.error("Purge account failed: {}", e.getMessage(), e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Failed to purge account", e.getMessage()));
        }
    }

    /**
     * DELETE /api/admin/users/batch/role/{role} - Batch delete all users with a specific role
     */
    @DeleteMapping("/users/batch/role/{role}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> batchDeleteUsersByRole(
            @PathVariable String role,
            HttpServletRequest httpRequest
    ) {
        log.info("Batch delete users with role: {}", role);

        try {
            // Get admin user info for audit log
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            UserDetailsServiceImpl.CustomUserDetails adminDetails =
                    (UserDetailsServiceImpl.CustomUserDetails) authentication.getPrincipal();

            // Perform batch deletion
            int deletedCount = userService.batchDeleteUsersWithRole(role);

            // Log batch deletion
            auditService.logUserModification(
                    adminDetails.getUserId(),
                    adminDetails.getAccountId(),
                    "BATCH_DELETE",
                    String.format("Batch deleted %d users with role: %s", deletedCount, role),
                    httpRequest
            );

            Map<String, Object> responseData = new HashMap<>();
            responseData.put("deletedCount", deletedCount);
            responseData.put("role", role);

            return ResponseEntity.ok(ApiResponse.success(
                    String.format("Successfully deleted %d user(s) with role: %s", deletedCount, role),
                    responseData
            ));
        } catch (Exception e) {
            log.error("Batch delete users failed: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("Failed to batch delete users", e.getMessage()));
        }
    }

    /**
     * POST /api/admin/users/{userId}/restore - Restore logically deleted user within 30 days
     */
    @PostMapping("/users/{userId}/restore")
    public ResponseEntity<ApiResponse<Void>> restoreUser(
            @PathVariable Long userId,
            HttpServletRequest httpRequest
    ) {
        log.info("Restore user request for user ID: {}", userId);

        try {
            // Get admin user info for audit log
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            UserDetailsServiceImpl.CustomUserDetails adminDetails =
                    (UserDetailsServiceImpl.CustomUserDetails) authentication.getPrincipal();

            User user = userService.findById(userId);
            String accountId = user.getAccountId();

            userService.restoreUser(userId);

            auditService.logUserModification(
                    adminDetails.getUserId(),
                    adminDetails.getAccountId(),
                    accountId,
                    "Account restored (logical delete undo)",
                    httpRequest
            );

            return ResponseEntity.ok(ApiResponse.success("Account restored successfully", null));
        } catch (IllegalStateException e) {
            log.error("Restore blocked: {}", e.getMessage());
            return ResponseEntity.status(403)
                    .body(ApiResponse.error("Restore blocked", e.getMessage()));
        } catch (Exception e) {
            log.error("Restore account failed: {}", e.getMessage(), e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Failed to restore account", e.getMessage()));
        }
    }

    /**
     * PUT /api/admin/users/{userId}/reset - Reset user password
     */
    @PutMapping("/users/{userId}/reset")
    public ResponseEntity<ApiResponse<Map<String, Object>>> resetPassword(
            @PathVariable Long userId,
            HttpServletRequest httpRequest
    ) {
        log.info("Reset password request for user ID: {}", userId);

        try {
            // Get admin user info for authorization check
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            UserDetailsServiceImpl.CustomUserDetails adminDetails =
                    (UserDetailsServiceImpl.CustomUserDetails) authentication.getPrincipal();

            // SECURITY: Prevent admins from resetting their own password
            // Admins must use the normal change password flow for their own accounts
            if (adminDetails.getUserId().equals(userId)) {
                log.warn("Admin {} attempted to reset own password via admin endpoint", adminDetails.getAccountId());
                return ResponseEntity.status(403)
                        .body(ApiResponse.error("Security violation", "You cannot reset your own password. Use the change password feature instead."));
            }

            // Get user info before reset for audit log
            User user = userService.findById(userId);
            String accountId = user.getAccountId();

            // Reset password (generates temporary password)
            UserCreationResult resetResult = userService.resetPassword(userId);

            // Log password reset
            auditService.logUserModification(
                    adminDetails.getUserId(),
                    adminDetails.getAccountId(),
                    accountId,
                    "Password reset (MFA disabled)",
                    httpRequest
            );

            // Prepare response with temporary password for ONE-TIME DISPLAY
            // Password shown once in admin UI, not persisted in logs or database
            Map<String, Object> responseData = new HashMap<>();
            responseData.put("userId", resetResult.getUserId());
            responseData.put("accountId", resetResult.getAccountId());
            responseData.put("email", resetResult.getEmail());
            responseData.put("fullName", resetResult.getFullName());
            responseData.put("temporaryPassword", resetResult.getInitialPassword()); // One-time display only
            responseData.put("message", "Password reset successfully. IMPORTANT: Save this password - it will only be shown once.");

            return ResponseEntity.ok(ApiResponse.success("Password reset successfully", responseData));
        } catch (Exception e) {
            log.error("Reset password failed: {}", e.getMessage(), e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Failed to reset password", e.getMessage()));
        }
    }

    /**
     * GET /api/admin/blocked-ips - Get list of blocked IP addresses
     */
    @GetMapping("/blocked-ips")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getBlockedIps() {
        log.info("Admin requesting blocked IPs list");

        try {
            Map<String, IpLoginAttemptService.IpStatusInfo> blockedIps = ipLoginAttemptService.getBlockedIps();
            
            Map<String, Object> responseData = new HashMap<>();
            responseData.put("blockedIps", blockedIps.values());
            responseData.put("count", blockedIps.size());

            return ResponseEntity.ok(ApiResponse.success("Blocked IPs retrieved successfully", responseData));
        } catch (Exception e) {
            log.error("Failed to get blocked IPs: {}", e.getMessage(), e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Failed to get blocked IPs", e.getMessage()));
        }
    }

    /**
     * POST /api/admin/blocked-ips/{ipAddress}/unblock - Unblock an IP address
     */
    @PostMapping("/blocked-ips/{ipAddress}/unblock")
    public ResponseEntity<ApiResponse<Void>> unblockIp(
            @PathVariable String ipAddress,
            HttpServletRequest httpRequest
    ) {
        log.info("Admin unblocking IP: {}", ipAddress);

        try {
            // Get admin user info for audit log
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            UserDetailsServiceImpl.CustomUserDetails adminDetails =
                    (UserDetailsServiceImpl.CustomUserDetails) authentication.getPrincipal();

            // Unblock IP
            ipLoginAttemptService.unblockIp(ipAddress);

            // Log IP unblock action
            auditService.logUserModification(
                    adminDetails.getUserId(),
                    adminDetails.getAccountId(),
                    ipAddress,
                    "IP address unblocked",
                    httpRequest
            );

            return ResponseEntity.ok(ApiResponse.success("IP address unblocked successfully", null));
        } catch (Exception e) {
            log.error("Failed to unblock IP: {}", e.getMessage(), e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Failed to unblock IP", e.getMessage()));
        }
    }

    /**
     * GET /api/admin/password-reset-requests - Get pending password reset requests
     */
    @GetMapping("/password-reset-requests")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getPasswordResetRequests(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        log.info("Admin requesting password reset requests (page: {}, size: {})", page, size);

        try {
            org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(page, size);
            org.springframework.data.domain.Page<PasswordResetRequest> requests = passwordResetRequestService.getPendingRequests(pageable);

            Map<String, Object> responseData = new HashMap<>();
            responseData.put("requests", requests.getContent());
            responseData.put("totalElements", requests.getTotalElements());
            responseData.put("totalPages", requests.getTotalPages());
            responseData.put("currentPage", page);

            return ResponseEntity.ok(ApiResponse.success("Password reset requests retrieved successfully", responseData));
        } catch (Exception e) {
            log.error("Failed to get password reset requests: {}", e.getMessage(), e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Failed to get password reset requests", e.getMessage()));
        }
    }

    /**
     * POST /api/admin/password-reset-requests/{requestId}/approve - Approve password reset request
     */
    @PostMapping("/password-reset-requests/{requestId}/approve")
    public ResponseEntity<ApiResponse<Map<String, Object>>> approvePasswordResetRequest(
            @PathVariable Long requestId,
            @RequestBody(required = false) Map<String, String> body,
            HttpServletRequest httpRequest
    ) {
        log.info("Admin approving password reset request: {}", requestId);

        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            UserDetailsServiceImpl.CustomUserDetails adminDetails =
                    (UserDetailsServiceImpl.CustomUserDetails) authentication.getPrincipal();

            String notes = body != null ? body.get("notes") : null;

            passwordResetRequestService.approveRequest(
                    requestId,
                    adminDetails.getUserId(),
                    adminDetails.getAccountId(),
                    notes != null ? notes : "Password reset approved",
                    httpRequest
            );

            Map<String, Object> responseData = new HashMap<>();
            responseData.put("message", "Password reset request approved. User password has been reset.");

            return ResponseEntity.ok(ApiResponse.success("Request approved successfully", responseData));
        } catch (Exception e) {
            log.error("Failed to approve password reset request: {}", e.getMessage(), e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Failed to approve request", e.getMessage()));
        }
    }

    /**
     * POST /api/admin/password-reset-requests/{requestId}/reject - Reject password reset request
     */
    @PostMapping("/password-reset-requests/{requestId}/reject")
    public ResponseEntity<ApiResponse<Void>> rejectPasswordResetRequest(
            @PathVariable Long requestId,
            @RequestBody Map<String, String> body,
            HttpServletRequest httpRequest
    ) {
        log.info("Admin rejecting password reset request: {}", requestId);

        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            UserDetailsServiceImpl.CustomUserDetails adminDetails =
                    (UserDetailsServiceImpl.CustomUserDetails) authentication.getPrincipal();

            String reason = body.get("reason");
            if (reason == null || reason.trim().isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("Rejection reason is required"));
            }

            passwordResetRequestService.rejectRequest(
                    requestId,
                    adminDetails.getUserId(),
                    adminDetails.getAccountId(),
                    reason,
                    httpRequest
            );

            return ResponseEntity.ok(ApiResponse.success("Request rejected successfully", null));
        } catch (Exception e) {
            log.error("Failed to reject password reset request: {}", e.getMessage(), e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Failed to reject request", e.getMessage()));
        }
    }
}
