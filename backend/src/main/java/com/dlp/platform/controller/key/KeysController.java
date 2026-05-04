package com.dlp.platform.controller.key;

import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.entity.User;
import com.dlp.platform.service.audit.AuditService;
import com.dlp.platform.service.key.KeyManagementService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;

/**
 * Phase 05: User encryption key management — setup, revoke, recover, regenerate, status.
 * All key endpoints (except admin revoke) operate on the current user.
 */
@Slf4j
@RestController
@RequestMapping("/keys")
@RequiredArgsConstructor
public class KeysController {

    private final KeyManagementService keyManagementService;
    private final AuditService auditService;

    @GetMapping("/status")
    public ResponseEntity<ApiResponse<KeyManagementService.KeyStatusResponse>> getStatus(
            @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(401).body(ApiResponse.error("Not authenticated"));
        }
        if (!keyManagementService.isEnabled()) {
            return ResponseEntity.ok(ApiResponse.success("Key management disabled",
                    new KeyManagementService.KeyStatusResponse(null, null, null, null, null, false, null, false)));
        }
        KeyManagementService.KeyStatusResponse status = keyManagementService.getKeyStatus(currentUser.getId());
        return ResponseEntity.ok(ApiResponse.success("Key status", status));
    }

    @PostMapping("/setup")
    public ResponseEntity<ApiResponse<KeyManagementService.KeySetupResult>> setup(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(401).body(ApiResponse.error("Not authenticated"));
        }
        if (!keyManagementService.isEnabled()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Key management is disabled"));
        }
        if (keyManagementService.isAdminEscrowMode()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Self-service key setup is disabled in ADMIN_ESCROW mode"));
        }
        String password = body.get("password");
        if (password == null || password.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Password is required"));
        }
        try {
            KeyManagementService.KeySetupResult result = keyManagementService.setupKey(currentUser.getId(), password);
            return ResponseEntity.ok(ApiResponse.success("Key setup complete. Save your recovery key securely.", result));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PostMapping("/verify-password")
    public ResponseEntity<ApiResponse<Boolean>> verifyPassword(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(401).body(ApiResponse.error("Not authenticated"));
        }
        String password = body.get("password");
        if (password == null) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Password is required"));
        }
        boolean valid = keyManagementService.verifyPassword(currentUser.getId(), password);
        return ResponseEntity.ok(ApiResponse.success("Password verification", valid));
    }

    @PostMapping("/recover")
    public ResponseEntity<ApiResponse<KeyManagementService.KeySetupResult>> recover(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(401).body(ApiResponse.error("Not authenticated"));
        }
        if (!keyManagementService.isEnabled()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Key management is disabled"));
        }
        if (keyManagementService.isAdminEscrowMode()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Self-service key recovery is disabled in ADMIN_ESCROW mode"));
        }
        String recoveryKey = body.get("recoveryKey");
        String newPassword = body.get("newPassword");
        if (recoveryKey == null || recoveryKey.isBlank() || newPassword == null || newPassword.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("recoveryKey and newPassword are required"));
        }
        try {
            KeyManagementService.KeySetupResult result = keyManagementService.recoverKey(
                    currentUser.getId(), recoveryKey.trim(), newPassword);
            return ResponseEntity.ok(ApiResponse.success("Key recovered. Save your new recovery key.", result));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PostMapping("/regenerate")
    public ResponseEntity<ApiResponse<KeyManagementService.KeySetupResult>> regenerate(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            return ResponseEntity.status(401).body(ApiResponse.error("Not authenticated"));
        }
        if (!keyManagementService.isEnabled()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Key management is disabled"));
        }
        if (keyManagementService.isAdminEscrowMode()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Self-service key regeneration is disabled in ADMIN_ESCROW mode"));
        }
        String currentPassword = body.get("currentPassword");
        String newPassword = body.get("newPassword");
        if (currentPassword == null || newPassword == null || newPassword.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("currentPassword and newPassword are required"));
        }
        try {
            KeyManagementService.KeySetupResult result = keyManagementService.regenerateKey(
                    currentUser.getId(), currentPassword, newPassword);
            return ResponseEntity.ok(ApiResponse.success("Key regenerated. Save your new recovery key.", result));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    /**
     * Admin or system: revoke a user's key (e.g. after anomaly detection).
     */
    @PostMapping("/revoke")
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER')")
    public ResponseEntity<ApiResponse<Void>> revoke(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest request) {
        if (!keyManagementService.isEnabled()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Key management is disabled"));
        }
        Object userIdObj = body.get("userId");
        String reason = body.get("reason") != null ? body.get("reason").toString() : "Admin revoke";
        if (userIdObj == null) {
            return ResponseEntity.badRequest().body(ApiResponse.error("userId is required"));
        }
        long userId = userIdObj instanceof Number ? ((Number) userIdObj).longValue() : Long.parseLong(userIdObj.toString());
        try {
            keyManagementService.revokeKey(userId, reason,
                    currentUser != null ? currentUser.getAccountId() : null,
                    getClientIp(request));
            return ResponseEntity.ok(ApiResponse.success("Key revoked", null));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    /**
     * Admin one-click incident response:
     * - revoke user's key
     * - force password change (handled inside revokeKey)
     * - emit security alert in audit log
     */
    @PostMapping("/admin/revoke-force-reset")
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER')")
    public ResponseEntity<ApiResponse<Void>> revokeForceResetAndAlert(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest request) {
        if (!keyManagementService.isEnabled()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Key management is disabled"));
        }
        Object userIdObj = body.get("userId");
        String reason = body.get("reason") != null ? body.get("reason").toString() : "Security incident response";
        if (userIdObj == null) {
            return ResponseEntity.badRequest().body(ApiResponse.error("userId is required"));
        }
        long userId = userIdObj instanceof Number ? ((Number) userIdObj).longValue() : Long.parseLong(userIdObj.toString());
        try {
            String actor = currentUser != null ? currentUser.getAccountId() : "SYSTEM";
            keyManagementService.revokeKey(userId, reason, actor, getClientIp(request));
            auditService.logEvent(
                currentUser != null ? currentUser.getId() : null,
                actor,
                "SECURITY_ALERT_TRIGGERED",
                "SECURITY",
                "WARNING",
                String.format("Forced incident workflow executed for userId=%d: revoke key + force password reset. reason=%s", userId, reason),
                getClientIp(request),
                request.getHeader("User-Agent"),
                null
            );
            return ResponseEntity.ok(ApiResponse.success("Incident workflow executed", null));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    /**
     * Admin operation for operational master key rotation:
     * rewrap all user operational keys to the active operational key id.
     */
    @PostMapping("/admin/rewrap-operational-keys")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<KeyManagementService.OperationalRewrapResult>> rewrapOperationalKeys(
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest request) {
        if (!keyManagementService.isEnabled()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Key management is disabled"));
        }
        KeyManagementService.OperationalRewrapResult result = keyManagementService.rewrapOperationalKeysToActiveKey();
        auditService.logEvent(
            currentUser != null ? currentUser.getId() : null,
            currentUser != null ? currentUser.getAccountId() : "SYSTEM",
            "OPERATIONAL_KEY_REWRAP",
            "KEY_MANAGEMENT",
            result.failed() == 0 ? "SUCCESS" : "WARNING",
            String.format("Operational key rewrap completed: target=%s processed=%d skipped=%d failed=%d",
                result.targetKeyId(), result.processed(), result.skipped(), result.failed()),
            getClientIp(request),
            request.getHeader("User-Agent"),
            null
        );
        return ResponseEntity.ok(ApiResponse.success("Operational key rewrap completed", result));
    }

    /**
     * Extract client IP address from request, checking X-Forwarded-For header first.
     */
    private String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isEmpty() && !"unknown".equalsIgnoreCase(xff)) {
            if (xff.contains(",")) {
                xff = xff.split(",")[0].trim();
            }
            return xff;
        }
        return request.getRemoteAddr();
    }
}
