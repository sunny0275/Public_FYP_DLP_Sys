package com.dlp.platform.service.auth;

import com.dlp.platform.dto.auth.ChangePasswordRequest;
import com.dlp.platform.dto.auth.LoginRequest;
import com.dlp.platform.dto.auth.LoginResponse;
import com.dlp.platform.entity.User;
import com.dlp.platform.exception.AccountLockedException;
import com.dlp.platform.exception.AuthenticationException;
import com.dlp.platform.exception.InvalidPasswordException;
import com.dlp.platform.exception.ResourceNotFoundException;
import com.dlp.platform.util.JwtUtil;
import com.dlp.platform.util.MfaUtil;
import com.dlp.platform.util.PasswordUtil;
import com.dlp.platform.service.admin.AccountBruteForceTrackerService;
import com.dlp.platform.service.admin.IpLoginAttemptService;
import com.dlp.platform.service.admin.IpPatternTrackerService;
import com.dlp.platform.service.admin.RolePermissionService;
import com.dlp.platform.service.admin.UserService;
import com.dlp.platform.service.audit.AuditService;
import com.dlp.platform.service.key.AnomalyDetectionService;
import com.dlp.platform.service.key.KeyManagementService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserService userService;
    private final AuditService auditService;
    private final RolePermissionService rolePermissionService;
    private final JwtUtil jwtUtil;
    private final PasswordUtil passwordUtil;
    private final MfaUtil mfaUtil;
    private final IpLoginAttemptService ipLoginAttemptService;
    private final IpPatternTrackerService ipPatternTrackerService;
    private final AccountBruteForceTrackerService accountBruteForceTrackerService;
    private final AnomalyDetectionService anomalyDetectionService;
    private final KeyManagementService keyManagementService;
    private final ApplicationContext applicationContext;

    @Value("${security.password.reminder-days}")
    private int passwordReminderDays;

    @Transactional
    public LoginResponse login(LoginRequest request, HttpServletRequest httpRequest) {
        log.info("Login attempt for account: {}", request.getAccountId());

        String clientIp = getClientIP(httpRequest);

        // First, check if this is a blocked IP (but admin users can bypass)
        if (ipLoginAttemptService.isIpBlocked(clientIp)) {
            try {
                // Check if user exists and has ADMIN role
                User user = userService.findByAccountId(request.getAccountId());
                boolean isAdminUser = user.getRoles() != null && user.getRoles().contains("ADMIN");
                
                if (isAdminUser) {
                    // Admin users can bypass IP block
                    log.warn("Admin user {} bypassing IP block for IP: {}", request.getAccountId(), clientIp);
                } else {
                    // Non-admin users are blocked
                    int remainingMinutes = ipLoginAttemptService.getRemainingFreezeMinutes(clientIp);
                    if (remainingMinutes > 0) {
                        log.warn("Login blocked: IP {} is frozen for {} more minutes", clientIp, remainingMinutes);
                        throw new AuthenticationException(
                            String.format("Too many failed login attempts. Please try again in %d minutes.", remainingMinutes)
                        );
                    } else {
                        log.warn("Login blocked: IP {} is permanently blocked", clientIp);
                        throw new AuthenticationException(
                            "Your IP address has been blocked due to repeated failed login attempts. Please contact administrator."
                        );
                    }
                }
            } catch (ResourceNotFoundException e) {
                // User doesn't exist - still block the IP
                int remainingMinutes = ipLoginAttemptService.getRemainingFreezeMinutes(clientIp);
                if (remainingMinutes > 0) {
                    log.warn("Login blocked: IP {} is frozen for {} more minutes", clientIp, remainingMinutes);
                    throw new AuthenticationException(
                        String.format("Too many failed login attempts. Please try again in %d minutes.", remainingMinutes)
                    );
                } else {
                    log.warn("Login blocked: IP {} is permanently blocked", clientIp);
                    throw new AuthenticationException(
                        "Your IP address has been blocked due to repeated failed login attempts. Please contact administrator."
                    );
                }
            }
        }

        try {
            // Find user
            User user = userService.findByAccountId(request.getAccountId());

            // Check if this is an admin user (based on role)
            boolean isAdminUser = user.getRoles() != null && user.getRoles().contains("ADMIN");

            // Validate account status
            userService.validateAccountStatus(user);

            // Verify password
            if (!passwordUtil.verifyPassword(request.getPassword(), user.getHashedPassword())) {
                // Admin users bypass IP block and account lockout (but still get "invalid password" response)
                // Record IP failed attempt and check for multi-IP brute force on account (skip for admin users)
                if (!isAdminUser) {
                    // Record IP failed attempt (IP-based freeze)
                    IpLoginAttemptService.FreezeResult freezeResult = 
                        ipLoginAttemptService.recordFailedAttempt(clientIp, request.getAccountId());
                    
                    // Record failed attempt for multi-IP brute force detection (account-based disable)
                    boolean shouldDisableAccount = accountBruteForceTrackerService.recordFailedAttempt(
                        request.getAccountId(), clientIp);
                    
                    if (shouldDisableAccount) {
                        // Disable the account due to multi-IP brute force attack
                        userService.disableAccount(user.getId(), "Disabled due to multi-IP brute force attack");
                        
                        AuditService auditProxy = applicationContext.getBean(AuditService.class);
                        auditProxy.logAccountSecurityEvent(user.getId(), request.getAccountId(),
                            "ACCOUNT_DISABLE_BRUTE_FORCE", "CRITICAL",
                            "Account disabled due to brute force attack from " + 
                            accountBruteForceTrackerService.getUniqueIpCount(request.getAccountId()) + " unique IPs",
                            clientIp);
                        
                        log.warn("Account {} DISABLED due to multi-IP brute force attack from {} unique IPs",
                            request.getAccountId(), accountBruteForceTrackerService.getUniqueIpCount(request.getAccountId()));
                        
                        throw new AuthenticationException(
                            "Account has been disabled due to suspicious activity. Please contact administrator.");
                    }
                    
                    // Also handle single-IP account lockout (existing logic)
                    userService.handleLoginAttempt(request.getAccountId(), false);
                    anomalyDetectionService.triggerRevokeIfNeeded(user.getId(), "Multiple failed login attempts", clientIp);
                    
                    // Log detailed IP security event to audit_logs - call through proxy for NEW transaction
                    AuditService auditProxy = applicationContext.getBean(AuditService.class);
                    auditProxy.logLoginFailure(request.getAccountId(), 
                        "Invalid credentials. " + freezeResult.getMessage(), httpRequest);
                    
                    // Check if IP was permanently blocked
                    if (freezeResult.isBlocked()) {
                        throw new AuthenticationException(freezeResult.getMessage());
                    } else if (freezeResult.isFrozen()) {
                        throw new AuthenticationException(freezeResult.getMessage());
                    }
                } else {
                    log.warn("Skipping security locks for admin user: {} (IP: {})", request.getAccountId(), clientIp);
                }
                
                throw new AuthenticationException("Invalid account ID or password");
            }

            // For first login or password change required, skip MFA and return setup required response
            // Generate temporary token for password change
            // Also treat expired passwords (non-admin) as requiring password change flow
            if (!isAdminUser && user.isPasswordExpired()) {
                log.info("Password expired for user: {} - returning password change required response", request.getAccountId());

                String tempAccessToken = jwtUtil.generateAccessToken(
                        user.getId(), user.getAccountId(), user.getRoles(), user.getTokenVersion());
                String tempRefreshToken = jwtUtil.generateRefreshToken(user.getId(), user.getAccountId());

                LoginResponse response = buildPasswordChangeRequiredResponse(user, tempAccessToken, tempRefreshToken);
                log.info("Password expired response: firstLogin={}, passwordChangeRequired={}",
                        response.isFirstLogin(), response.isPasswordChangeRequired());
                return response;
            }

            if (user.getFirstLogin() || user.getPasswordChangeRequired()) {
                log.info("First login or password change required for user: {} (firstLogin: {}, passwordChangeRequired: {})", 
                        request.getAccountId(), user.getFirstLogin(), user.getPasswordChangeRequired());

                // Generate temporary access token (valid for password change only)
                // This token allows the user to change password without full authentication
                String tempAccessToken = jwtUtil.generateAccessToken(user.getId(), user.getAccountId(), user.getRoles(), user.getTokenVersion());
                String tempRefreshToken = jwtUtil.generateRefreshToken(user.getId(), user.getAccountId());

                LoginResponse response = buildPasswordChangeRequiredResponse(user, tempAccessToken, tempRefreshToken);
                log.info("Returning password change required response: firstLogin={}, passwordChangeRequired={}", 
                        response.isFirstLogin(), response.isPasswordChangeRequired());
                return response;
            }

            // Verify MFA if enabled (MFA is mandatory for all users)
            if (user.getMfaEnabled()) {
                if (request.getMfaCode() == null || request.getMfaCode().isEmpty()) {
                    log.info("MFA code required for user: {}", request.getAccountId());
                    return buildMfaRequiredResponse(user);
                }

                int mfaCode;
                try {
                    mfaCode = Integer.parseInt(request.getMfaCode());
                } catch (NumberFormatException e) {
                    log.error("MFA code format error - received: '{}'", request.getMfaCode());
                    auditService.logMfaVerification(user.getId(), user.getAccountId(), false, httpRequest);
                    int remaining = userService.recordMfaLoginFailure(request.getAccountId());
                    throw new AuthenticationException("Invalid MFA code format. Attempts left: " + remaining);
                }

                if (!userService.verifyMfaCode(user.getId(), mfaCode)) {
                    auditService.logMfaVerification(user.getId(), user.getAccountId(), false, httpRequest);
                    int remaining = userService.recordMfaLoginFailure(request.getAccountId());
                    throw new AuthenticationException("Invalid MFA code. Attempts left: " + remaining);
                }

                auditService.logMfaVerification(user.getId(), user.getAccountId(), true, httpRequest);
                // Successful MFA -> reset MFA attempt counter
                userService.resetMfaLoginAttempts(request.getAccountId());
            }

            // If MFA not enabled but account requires it (security policy), initiate setup
            // Force MFA setup for both first-time users after password change AND returning users
            if (!user.getMfaEnabled()) {
                log.info("MFA setup required for user: {}", request.getAccountId());
                MfaUtil.MfaSetupData setupData = userService.setupMfa(user.getId());
                String setupAccessToken = jwtUtil.generateAccessToken(user.getId(), user.getAccountId(), user.getRoles(), user.getTokenVersion());
                String setupRefreshToken = jwtUtil.generateRefreshToken(user.getId(), user.getAccountId());
                return buildMfaSetupResponse(user, setupData, setupAccessToken, setupRefreshToken);
            }

            // Generate tokens
            String accessToken = jwtUtil.generateAccessToken(user.getId(), user.getAccountId(), user.getRoles(), user.getTokenVersion());
            String refreshToken = jwtUtil.generateRefreshToken(user.getId(), user.getAccountId());

            // Update login status
            userService.handleLoginAttempt(request.getAccountId(), true);
            userService.updateLastLogin(user.getId());

            // Record successful login for IP (resets attempt counter)
            log.info("Recording successful login for IP: {} - attempting to reset IP tracking", clientIp);
            ipLoginAttemptService.recordSuccessfulLogin(clientIp);
            log.info("IP tracking reset completed for IP: {}", clientIp);

            // Analyze IP pattern for unusual login location (non-admin users)
            // Log warnings for unusual IPs, but do NOT block or disable - MFA provides protection
            if (!isAdminUser) {
                IpPatternTrackerService.IpAnalysisResult ipResult = 
                    ipPatternTrackerService.analyzeAndRecordLogin(request.getAccountId(), clientIp, true);
                
                if (ipResult.getRiskLevel() != IpPatternTrackerService.IpRiskLevel.SAFE) {
                    // Log all unusual IP patterns as warnings for admin review
                    log.warn("Unusual login location for {}: {}", request.getAccountId(), ipResult.getReason());
                    
                    auditService.logIpSecurityEvent(
                        clientIp, request.getAccountId(), 
                        "IP_PATTERN_NOTICE", "INFO", 
                        ipResult.getReason() + " (MFA will protect account)", 0, null);
                }
            }

            // Log successful login
            auditService.logLoginSuccess(user.getId(), user.getAccountId(), httpRequest);

            // Build response
            return buildSuccessfulLoginResponse(user, accessToken, refreshToken);

        } catch (AuthenticationException | AccountLockedException e) {
            throw e;
        } catch (ResourceNotFoundException e) {
            // User not found - still track IP for brute-force protection
            log.warn("Login attempt for non-existent account: {} from IP: {}", 
                     request.getAccountId(), clientIp);
            
            // Track IP attempt even for non-existent accounts (brute-force protection)
            IpLoginAttemptService.FreezeResult freezeResult = 
                ipLoginAttemptService.recordFailedAttempt(clientIp, request.getAccountId());
            
            // Log both LOGIN_FAILURE (for standard audit) and IP_SECURITY event - call through proxy
            AuditService auditProxy = applicationContext.getBean(AuditService.class);
            auditProxy.logLoginFailure(request.getAccountId(), 
                "Invalid credentials (account not found). " + freezeResult.getMessage(), httpRequest);
            
            // If IP is frozen or blocked, include that info in the response
            if (freezeResult.isBlocked()) {
                throw new AuthenticationException(
                    "Your IP address has been blocked due to repeated failed login attempts. Please contact administrator.");
            } else if (freezeResult.isFrozen()) {
                throw new AuthenticationException(freezeResult.getMessage());
            }
            
            throw new AuthenticationException("Invalid account ID or password");
        } catch (Exception e) {
            log.error("Login error for account {}: {}", request.getAccountId(), e.getMessage(), e);
            AuditService auditProxy = applicationContext.getBean(AuditService.class);
            auditProxy.logLoginFailure(request.getAccountId(), e.getMessage(), httpRequest);
            throw new AuthenticationException("Authentication failed");
        }
    }

    /**
     * Change password
     */
    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest request, HttpServletRequest httpRequest) {
        log.info("Password change request for user ID: {}", userId);

        // Validate password confirmation
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new InvalidPasswordException("Passwords do not match");
        }

        // Change password
        userService.changePassword(userId, request.getCurrentPassword(), request.getNewPassword());

        // Enterprise mode: auto-provision key after password setup/change, user never sees recovery key.
        if (keyManagementService.isEnabled() && keyManagementService.isAdminEscrowMode()) {
            try {
                boolean created = keyManagementService.ensureKeyExistsAfterPasswordChange(userId, request.getNewPassword());
                if (created) {
                    log.info("Auto-provisioned encryption key for user {} in ADMIN_ESCROW mode", userId);
                }
            } catch (Exception e) {
                log.error("Failed to auto-provision encryption key after password change for user {}", userId, e);
                throw new IllegalStateException("Failed to initialize encryption key in ADMIN_ESCROW mode");
            }
        }

        // Log password change
        User user = userService.findById(userId);
        boolean forced = user.getPasswordChangeRequired();
        auditService.logPasswordChange(userId, user.getAccountId(), forced, httpRequest);

        log.info("Password changed successfully for user ID: {}", userId);
    }

    /**
     * Setup MFA for user
     */
    @Transactional
    public MfaUtil.MfaSetupData setupMfa(Long userId, HttpServletRequest httpRequest) {
        log.info("MFA setup request for user ID: {}", userId);

        MfaUtil.MfaSetupData setupData = userService.setupMfa(userId);

        log.info("MFA setup data generated for user ID: {}", userId);
        return setupData;
    }

    /**
     * Verify and enable MFA
     */
    @Transactional
    public void verifyAndEnableMfa(Long userId, int verificationCode, HttpServletRequest httpRequest) {
        log.info("MFA verification request for user ID: {}", userId);

        userService.enableMfa(userId, verificationCode);

        // Log MFA setup
        User user = userService.findById(userId);
        auditService.logMfaSetup(userId, user.getAccountId(), httpRequest);

        log.info("MFA enabled successfully for user ID: {}", userId);
    }

    /**
     * Refresh access token using refresh token
     */
    public LoginResponse refreshToken(String refreshToken, HttpServletRequest httpRequest) {
        log.info("Token refresh request");

        try {
            // Validate refresh token
            if (!jwtUtil.validateRefreshToken(refreshToken)) {
                throw new AuthenticationException("Invalid or expired refresh token");
            }

            // Extract user information
            Long userId = jwtUtil.extractUserId(refreshToken);
            String accountId = jwtUtil.extractAccountId(refreshToken);

            // Get user
            User user = userService.findById(userId);

            // Validate account status
            userService.validateAccountStatus(user);

            // Generate new access token
            String newAccessToken = jwtUtil.generateAccessToken(user.getId(), user.getAccountId(), user.getRoles(), user.getTokenVersion());

            // Log token refresh
            auditService.logTokenRefresh(userId, accountId, httpRequest);

            // Calculate available dashboards
            Set<String> availableDashboards = rolePermissionService.getAvailableDashboardsFromStrings(user.getRoles());

            // Build response
            return LoginResponse.builder()
                    .accessToken(newAccessToken)
                    .refreshToken(refreshToken)
                    .tokenType("Bearer")
                    .expiresIn(jwtUtil.getAccessTokenExpiration())
                    .userId(user.getId())
                    .accountId(user.getAccountId())
                    .email(user.getEmail())
                    .fullName(user.getFullName())
                    .roles(user.getRoles())
                    .department(user.getDepartment())
                    .position(user.getPosition())
                    .availableDashboards(availableDashboards)
                    .build();

        } catch (Exception e) {
            log.error("Token refresh error: {}", e.getMessage(), e);
            throw new AuthenticationException("Failed to refresh token");
        }
    }

    /**
     * Logout user
     */
    public void logout(Long userId, HttpServletRequest httpRequest) {
        log.info("Logout request for user ID: {}", userId);

        User user = userService.findById(userId);
        auditService.logLogout(userId, user.getAccountId(), httpRequest);

        // In a production system, you might want to:
        // 1. Invalidate the refresh token (store in blacklist/database)
        // 2. Clear any server-side session data
        // Since we're using stateless JWT, we just log the logout

        log.info("User logged out successfully: {}", user.getAccountId());
    }

    /**
     * Build successful login response
     */
    private LoginResponse buildSuccessfulLoginResponse(User user, String accessToken, String refreshToken) {
        // Calculate days until password expiry
        Integer daysUntilExpiry = null;
        boolean expiringSoon = false;

        if (user.getPasswordExpiryDate() != null) {
            long days = ChronoUnit.DAYS.between(LocalDateTime.now(), user.getPasswordExpiryDate());
            daysUntilExpiry = (int) days;
            expiringSoon = days <= passwordReminderDays && days > 0;
        }

        // Calculate available dashboards based on roles
        Set<String> availableDashboards = rolePermissionService.getAvailableDashboardsFromStrings(user.getRoles());

        return LoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(jwtUtil.getAccessTokenExpiration())
                .userId(user.getId())
                .accountId(user.getAccountId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .roles(user.getRoles())
                .department(user.getDepartment())
                .position(user.getPosition())
                .availableDashboards(availableDashboards)
                .firstLogin(false)
                .passwordChangeRequired(false)
                .mfaRequired(false)
                .mfaEnabled(user.getMfaEnabled())
                .passwordExpiringSoon(expiringSoon)
                .daysUntilPasswordExpiry(daysUntilExpiry)
                .build();
    }

    /**
     * Build password change required response
     * Includes temporary tokens to allow password change
     */
    private LoginResponse buildPasswordChangeRequiredResponse(User user, String accessToken, String refreshToken) {
        return LoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(jwtUtil.getAccessTokenExpiration())
                .userId(user.getId())
                .accountId(user.getAccountId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .firstLogin(user.getFirstLogin())
                .passwordChangeRequired(true)
                .mfaRequired(false)
                .mfaEnabled(user.getMfaEnabled())
                .roles(user.getRoles())
                .availableDashboards(rolePermissionService.getAvailableDashboardsFromStrings(user.getRoles()))
                .build();
    }

    /**
     * Build MFA required response (password correct, awaiting MFA code)
     */
    private LoginResponse buildMfaRequiredResponse(User user) {
        return LoginResponse.builder()
                .userId(user.getId())
                .accountId(user.getAccountId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .firstLogin(false)
                .passwordChangeRequired(false)
                .mfaRequired(true)
                .mfaEnabled(true)
                .roles(user.getRoles())
                .availableDashboards(rolePermissionService.getAvailableDashboardsFromStrings(user.getRoles()))
                .build();
    }

    /**
     * Build MFA setup response
     */
    private LoginResponse buildMfaSetupResponse(User user, MfaUtil.MfaSetupData setupData, String accessToken, String refreshToken) {
        return LoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(jwtUtil.getAccessTokenExpiration())
                .userId(user.getId())
                .accountId(user.getAccountId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .firstLogin(false)
                .passwordChangeRequired(false)
                .mfaRequired(true)
                .mfaEnabled(false)
                .mfaQrCodeUrl(setupData.getQrCodeUrl())
                .mfaQrCodeImage(setupData.getQrCodeImage())
                .mfaSecret(setupData.getSecret())
                .roles(user.getRoles())
                .availableDashboards(rolePermissionService.getAvailableDashboardsFromStrings(user.getRoles()))
                .build();
    }

    /**
     * Extract client IP address from request
     * Handles proxied requests with X-Forwarded-For header
     */
    private String getClientIP(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }

        String xRealIP = request.getHeader("X-Real-IP");
        if (xRealIP != null && !xRealIP.isEmpty()) {
            return xRealIP;
        }

        return request.getRemoteAddr();
    }
}
