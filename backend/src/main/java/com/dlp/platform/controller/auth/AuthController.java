package com.dlp.platform.controller.auth;

import com.dlp.platform.dto.auth.*;
import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.entity.User;
import com.dlp.platform.security.UserDetailsServiceImpl;
import com.dlp.platform.service.auth.AuthService;
import com.dlp.platform.service.admin.PasswordResetRequestService;
import com.dlp.platform.service.admin.UserService;
import com.dlp.platform.util.MfaUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final PasswordResetRequestService passwordResetRequestService;
    private final UserService userService;
    private final MfaUtil mfaUtil;

    /**
     * POST /api/auth/login - User login
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest
    ) {
        log.info("Login request received for account: {}", request.getAccountId());

        try {
            LoginResponse response = authService.login(request, httpRequest);
            return ResponseEntity.ok(ApiResponse.success("Login successful", response));
        } catch (com.dlp.platform.exception.AccountLockedException e) {
            log.error("Login blocked (account locked): {}", e.getMessage());
            return ResponseEntity.status(403)
                    .body(ApiResponse.error("Account locked", e.getMessage()));
        } catch (com.dlp.platform.exception.AuthenticationException e) {
            log.error("Login failed: {}", e.getMessage());
            return ResponseEntity.status(401)
                    .body(ApiResponse.error("Authentication failed", e.getMessage()));
        } catch (Exception e) {
            log.error("Login failed: {}", e.getMessage());
            return ResponseEntity.status(401)
                    .body(ApiResponse.error("Authentication failed", e.getMessage()));
        }
    }

    /**
     * POST /api/auth/change-password - Change user password
     */
    @PostMapping("/change-password")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            HttpServletRequest httpRequest
    ) {
        try {
            Long userId = getCurrentUserId();
            authService.changePassword(userId, request, httpRequest);
            return ResponseEntity.ok(ApiResponse.success("Password changed successfully", null));
        } catch (Exception e) {
            log.error("Password change failed: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Password change failed", e.getMessage()));
        }
    }

    /**
     * POST /api/auth/mfa/setup - Setup MFA for user
     */
    @PostMapping("/mfa/setup")
    public ResponseEntity<ApiResponse<MfaSetupResponse>> setupMfa(HttpServletRequest httpRequest) {
        try {
            Long userId = getCurrentUserId();
            MfaUtil.MfaSetupData setupData = authService.setupMfa(userId, httpRequest);

            MfaSetupResponse response = MfaSetupResponse.builder()
                    .secret(setupData.getSecret())
                    .qrCodeUrl(setupData.getQrCodeUrl())
                    .qrCodeImage(setupData.getQrCodeImage())
                    .setupCompleted(false)
                    .build();

            return ResponseEntity.ok(ApiResponse.success("MFA setup initiated", response));
        } catch (Exception e) {
            log.error("MFA setup failed: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("MFA setup failed", e.getMessage()));
        }
    }

    /**
     * POST /api/auth/mfa/verify - Verify and enable MFA
     */
    @PostMapping("/mfa/verify")
    public ResponseEntity<ApiResponse<MfaSetupResponse>> verifyMfa(
            @Valid @RequestBody MfaSetupRequest request,
            HttpServletRequest httpRequest
    ) {
        try {
            Long userId = getCurrentUserId();
            int code = Integer.parseInt(request.getCode());

            authService.verifyAndEnableMfa(userId, code, httpRequest);

            MfaSetupResponse response = MfaSetupResponse.builder()
                    .setupCompleted(true)
                    .build();

            return ResponseEntity.ok(ApiResponse.success("MFA enabled successfully", response));
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Invalid MFA code format"));
        } catch (Exception e) {
            log.error("MFA verification failed: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("MFA verification failed", e.getMessage()));
        }
    }

    /**
     * POST /api/auth/refresh - Refresh access token
     */
    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<LoginResponse>> refreshToken(
            @Valid @RequestBody RefreshTokenRequest request,
            HttpServletRequest httpRequest
    ) {
        try {
            LoginResponse response = authService.refreshToken(request.getRefreshToken(), httpRequest);
            return ResponseEntity.ok(ApiResponse.success("Token refreshed successfully", response));
        } catch (Exception e) {
            log.error("Token refresh failed: {}", e.getMessage());
            return ResponseEntity.status(401)
                    .body(ApiResponse.error("Token refresh failed", e.getMessage()));
        }
    }

    /**
     * POST /api/auth/logout - Logout user
     */
    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(HttpServletRequest httpRequest) {
        try {
            Long userId = getCurrentUserId();
            authService.logout(userId, httpRequest);
            return ResponseEntity.ok(ApiResponse.success("Logged out successfully", null));
        } catch (Exception e) {
            log.error("Logout failed: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Logout failed", e.getMessage()));
        }
    }

    /**
     * GET /api/auth/me - Get current user information
     */
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserDetailsServiceImpl.CustomUserDetails>> getCurrentUser() {
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

            if (authentication != null && authentication.getPrincipal() instanceof UserDetailsServiceImpl.CustomUserDetails) {
                UserDetailsServiceImpl.CustomUserDetails userDetails =
                        (UserDetailsServiceImpl.CustomUserDetails) authentication.getPrincipal();
                return ResponseEntity.ok(ApiResponse.success(userDetails));
            }

            return ResponseEntity.status(401)
                    .body(ApiResponse.error("Not authenticated"));
        } catch (Exception e) {
            log.error("Get current user failed: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Failed to get user information", e.getMessage()));
        }
    }

    /**
     * Helper method to get current user ID from security context
     */
    private Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication != null && authentication.getPrincipal() instanceof UserDetailsServiceImpl.CustomUserDetails) {
            UserDetailsServiceImpl.CustomUserDetails userDetails =
                    (UserDetailsServiceImpl.CustomUserDetails) authentication.getPrincipal();
            return userDetails.getUserId();
        }

        throw new IllegalStateException("User not authenticated");
    }

    /**
     * GET /api/auth/mfa/debug-current-code - Debug: get current TOTP code (DEV ONLY)
     */
    @GetMapping("/mfa/debug-current-code")
    public ResponseEntity<ApiResponse<Map<String, Object>>> debugCurrentCode(HttpServletRequest httpRequest) {
        try {
            Long userId = getCurrentUserId();
            User user = userService.findById(userId);

            if (user.getMfaSecret() == null) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("MFA not set up"));
            }

            int currentCode = mfaUtil.generateCurrentCode(user.getMfaSecret());
            int timeIndex = (int) (System.currentTimeMillis() / 30000);

            Map<String, Object> debug = new java.util.HashMap<>();
            debug.put("currentCode", currentCode);
            debug.put("timeIndex", timeIndex);
            debug.put("secretLength", user.getMfaSecret().length());
            debug.put("secretFirst4", user.getMfaSecret().substring(0, Math.min(4, user.getMfaSecret().length())));
            debug.put("serverTimeMs", System.currentTimeMillis());

            return ResponseEntity.ok(ApiResponse.success(debug));
        } catch (Exception e) {
            log.error("Debug endpoint error: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Debug error: " + e.getMessage()));
        }
    }

    /**
     * POST /api/auth/forgot-password - Submit password reset request
     */
    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<Void>> forgotPassword(
            @RequestBody Map<String, String> request,
            HttpServletRequest httpRequest
    ) {
        String accountId = request.get("accountId");
        String email = request.get("email");

        if (accountId == null || email == null || accountId.trim().isEmpty() || email.trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Account ID and email are required"));
        }

        try {
            passwordResetRequestService.createRequest(accountId.trim(), email.trim(), httpRequest);
            return ResponseEntity.ok(ApiResponse.success(
                    "Password reset request submitted successfully. An administrator will review your request.",
                    null
            ));
        } catch (IllegalArgumentException e) {
            log.warn("Invalid password reset request: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Invalid request", e.getMessage()));
        } catch (IllegalStateException e) {
            log.warn("Password reset request blocked: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Request blocked", e.getMessage()));
        } catch (Exception e) {
            log.error("Password reset request failed: {}", e.getMessage(), e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Failed to submit request", e.getMessage()));
        }
    }
}
