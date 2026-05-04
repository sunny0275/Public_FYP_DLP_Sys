package com.dlp.platform.controller.auth;

import com.dlp.platform.dto.auth.MfaSetupRequest;
import com.dlp.platform.dto.auth.MfaSetupResponse;
import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.dto.user.UpdateProfileRequest;
import com.dlp.platform.dto.user.UserProfileResponse;
import com.dlp.platform.entity.User;
import com.dlp.platform.service.admin.UserService;
import com.dlp.platform.service.auth.AuthService;
import com.dlp.platform.util.MfaUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.PageImpl;
import com.dlp.platform.dto.audit.AuditLogSearchCriteria;
import com.dlp.platform.service.dashboard.SecurityAnalyticsService;

/**
 * REST Controller for user profile management (self-service)
 *
 * Endpoints:
 * - GET /api/me - View own profile
 * - PUT /api/me - Update own profile (limited fields: email, fullName)
 * - GET /api/me/activity - Download personal activity report (signed CSV)
 * - POST /api/me/mfa/bind - Initiate MFA re-bind (returns new QR)
 * - POST /api/me/mfa/bind/verify - Verify code and complete MFA re-bind
 *
 * All endpoints require authentication. Users can only view/edit their own profile.
 * Roles, department, and position are read-only (require admin to modify).
 */
@RestController
@RequestMapping("/me")
@Slf4j
@RequiredArgsConstructor
public class MeController {

    private final UserService userService;
    private final AuthService authService;
    private final com.dlp.platform.repository.AuditLogRepository auditLogRepository;
    private final SecurityAnalyticsService securityAnalyticsService;

    /**
     * Get current user's profile
     * GET /api/me
     *
     * Returns full user profile with roles, department, position (read-only)
     *
     * @param currentUser Authenticated user from JWT token
     * @return User profile response
     */
    @GetMapping
    public ResponseEntity<ApiResponse<UserProfileResponse>> getProfile(
            @AuthenticationPrincipal User currentUser) {

        log.info("User {} requesting own profile", currentUser.getAccountId());

        // Always reload from DB to reflect latest account status (e.g. UEBA disable mid-session).
        User latest = userService.findById(currentUser.getId());
        if (Boolean.FALSE.equals(latest.getAccountEnabled())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.error("Account is disabled"));
        }

        UserProfileResponse profile = UserProfileResponse.from(latest);
        return ResponseEntity.ok(ApiResponse.success("Profile retrieved successfully", profile));
    }

    /**
     * Update current user's profile (limited fields only)
     * PUT /api/me
     *
     * Allowed fields: email, fullName
     * Forbidden fields: roles, department, position, accountId (require admin)
     *
     * @param request Update request with email and fullName
     * @param currentUser Authenticated user from JWT token
     * @param httpRequest HTTP request for IP address logging
     * @return Updated profile response
     */
    @PutMapping
    public ResponseEntity<ApiResponse<UserProfileResponse>> updateProfile(
            @Valid @RequestBody UpdateProfileRequest request,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest httpRequest) {

        try {
            String ipAddress = httpRequest.getRemoteAddr();
            log.info("User {} updating own profile from IP {}", currentUser.getAccountId(), ipAddress);

            UserProfileResponse updated = userService.updateProfile(currentUser, request, ipAddress);

            return ResponseEntity.ok(ApiResponse.success("Profile updated successfully", updated));

        } catch (IllegalArgumentException e) {
            log.warn("Profile update validation failed for user {}: {}",
                currentUser.getAccountId(), e.getMessage());
            return ResponseEntity.badRequest()
                .body(ApiResponse.error(e.getMessage()));

        } catch (Exception e) {
            log.error("Error updating profile for user " + currentUser.getAccountId(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to update profile"));
        }
    }

    /**
     * Download personal activity report (signed CSV)
     * GET /api/me/activity
     */
    @GetMapping(value = "/activity", produces = "text/csv")
    public ResponseEntity<byte[]> getActivityReport(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(required = false) String format) {

        var pageable = org.springframework.data.domain.PageRequest.of(0, 10_000,
                org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "timestamp"));
        var page = auditLogRepository.findByUserId(currentUser.getId(), pageable);
        var logs = page.getContent();

        StringBuilder csv = new StringBuilder();
        csv.append("Timestamp,Action,Category,Result,IP Address,Details\n");
        for (var log : logs) {
            csv.append(escapeCsv(log.getTimestamp() != null ? log.getTimestamp().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME) : ""));
            csv.append(",").append(escapeCsv(log.getAction()));
            csv.append(",").append(escapeCsv(log.getCategory()));
            csv.append(",").append(escapeCsv(log.getResult()));
            csv.append(",").append(escapeCsv(log.getIpAddress()));
            csv.append(",").append(escapeCsv(log.getDetails())).append("\n");
        }
        byte[] content = csv.toString().getBytes(StandardCharsets.UTF_8);

        String hash;
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            hash = Base64.getEncoder().encodeToString(digest.digest(content));
        } catch (Exception e) {
            hash = "";
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentDispositionFormData("attachment",
                "my-activity-report-" + LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE).replace(":", "-") + ".csv");
        headers.set("X-Report-Hash", hash);
        headers.set("X-Report-Generated", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        return ResponseEntity.ok().headers(headers).body(content);
    }

    private static String escapeCsv(String s) {
        if (s == null) return "";
        if (s.contains(",") || s.contains("\"") || s.contains("\n")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }

    /**
     * Get current user's own audit logs (paginated).
     * Any authenticated user can view their own records including VIEW, BULK_VIEW, UEBA events.
     * GET /api/me/audit-logs
     */
    @GetMapping("/audit-logs")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getMyAuditLogs(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) String startTime,
            @RequestParam(required = false) String endTime
    ) {
        log.debug("User {} fetching own audit logs (page={}, size={}, action={})",
                currentUser.getAccountId(), page, size, action);

        var pageable = PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "timestamp"));

        AuditLogSearchCriteria criteria = AuditLogSearchCriteria.builder()
                .userId(currentUser.getId())
                .action(action)
                .category(category)
                .result(result)
                .startTime(parseTimestamp(startTime))
                .endTime(parseTimestamp(endTime))
                .build();

        Page<Map<String, Object>> logPage = securityAnalyticsService.searchAuditLogs(criteria, pageable);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", logPage.getContent());
        response.put("totalElements", logPage.getTotalElements());
        response.put("totalPages", logPage.getTotalPages());
        response.put("currentPage", logPage.getNumber());
        response.put("pageSize", logPage.getSize());

        return ResponseEntity.ok(ApiResponse.success("Audit logs retrieved", response));
    }

    private LocalDateTime parseTimestamp(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return LocalDateTime.parse(s, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } catch (Exception e) {
            try {
                return LocalDateTime.parse(s, DateTimeFormatter.ISO_LOCAL_DATE);
            } catch (Exception e2) {
                return null;
            }
        }
    }

    /**
     * Initiate MFA re-bind (e.g. new device). Returns new secret and QR code.
     * POST /api/me/mfa/bind
     */
    @PostMapping("/mfa/bind")
    public ResponseEntity<ApiResponse<MfaSetupResponse>> initiateMfaRebind(
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest httpRequest) {
        try {
            MfaUtil.MfaSetupData setupData = authService.setupMfa(currentUser.getId(), httpRequest);
            MfaSetupResponse response = MfaSetupResponse.builder()
                    .secret(setupData.getSecret())
                    .qrCodeUrl(setupData.getQrCodeUrl())
                    .qrCodeImage(setupData.getQrCodeImage())
                    .setupCompleted(false)
                    .build();
            return ResponseEntity.ok(ApiResponse.success("Scan the QR code with your authenticator app, then submit the code via POST /me/mfa/bind/verify", response));
        } catch (Exception e) {
            log.error("MFA re-bind initiate failed for user {}", currentUser.getAccountId(), e);
            return ResponseEntity.badRequest().body(ApiResponse.error("Failed to start MFA re-bind: " + e.getMessage()));
        }
    }

    /**
     * Verify code and complete MFA re-bind.
     * POST /api/me/mfa/bind/verify
     */
    @PostMapping("/mfa/bind/verify")
    public ResponseEntity<ApiResponse<MfaSetupResponse>> verifyMfaRebind(
            @Valid @RequestBody MfaSetupRequest request,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest httpRequest) {
        try {
            int code = Integer.parseInt(request.getCode());
            authService.verifyAndEnableMfa(currentUser.getId(), code, httpRequest);
            MfaSetupResponse response = MfaSetupResponse.builder().setupCompleted(true).build();
            return ResponseEntity.ok(ApiResponse.success("MFA re-bound successfully", response));
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Invalid code format"));
        } catch (Exception e) {
            log.error("MFA re-bind verify failed for user {}", currentUser.getAccountId(), e);
            return ResponseEntity.badRequest().body(ApiResponse.error("Verification failed: " + e.getMessage()));
        }
    }
}
