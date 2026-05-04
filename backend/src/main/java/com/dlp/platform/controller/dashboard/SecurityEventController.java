package com.dlp.platform.controller.dashboard;

import com.dlp.platform.dto.security.SecurityEventRequest;
import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.entity.User;
import com.dlp.platform.repository.UserRepository;
import com.dlp.platform.security.UserDetailsServiceImpl;
import com.dlp.platform.service.audit.AuditService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/security")
@RequiredArgsConstructor
public class SecurityEventController {

    private final AuditService auditService;
    private final UserRepository userRepository;

    @PostMapping("/events")
    public ResponseEntity<ApiResponse<Void>> logSecurityEvent(
            @Valid @RequestBody SecurityEventRequest request,
            HttpServletRequest httpRequest
    ) {
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            Long userId = null;
            String accountId;

            // If accountId is provided in the request (from Electron/Desktop agent),
            // use it to resolve the user. This handles cases where the Electron main process
            // sends events on behalf of a user who might not have a valid JWT token.
            if (request.getAccountId() != null && !request.getAccountId().isBlank()) {
                // For Electron events, we'll use the accountId from the request
                // The actual user lookup will be done by AuditService if needed
                accountId = request.getAccountId();

                // Resolve userId from accountId for UEBA scoring
                // Use case-insensitive search to handle different casing (e.g., "FI_EM_2026_001" vs "fi_em1")
                User user = userRepository.findByAccountIdIgnoreCase(request.getAccountId()).orElse(null);
                if (user != null) {
                    userId = user.getId();
                    log.debug("Resolved userId {} from accountId {} for UEBA scoring", userId, accountId);
                } else {
                    log.warn("Could not resolve userId from accountId: {}", request.getAccountId());
                }

                log.debug("Using accountId from request: {}", accountId);
            } else if (authentication != null && authentication.getPrincipal() instanceof UserDetailsServiceImpl.CustomUserDetails) {
                UserDetailsServiceImpl.CustomUserDetails userDetails =
                        (UserDetailsServiceImpl.CustomUserDetails) authentication.getPrincipal();
                userId = userDetails.getUserId();
                accountId = userDetails.getAccountId();
            } else {
                accountId = "SYSTEM";
            }

            // Use clientIp from request body if provided (frontend can detect local IP)
            // Otherwise fall back to server-detected IP
            String ipAddress;
            if (request.getClientIp() != null && !request.getClientIp().isBlank()) {
                ipAddress = request.getClientIp();
                log.debug("Using clientIp from request: {}", ipAddress);
            } else {
                ipAddress = getClientIpAddress(httpRequest);
            }

            String userAgent = httpRequest.getHeader("User-Agent");

            auditService.logEvent(
                    userId,
                    accountId,
                    request.getAction(),
                    request.getCategory(),
                    request.getResult(),
                    request.getDetails() == null ? "No details provided" : request.getDetails(),
                    ipAddress,
                    userAgent,
                    httpRequest.getHeader("X-Device-Fingerprint")
            );

            return ResponseEntity.ok(ApiResponse.success("Security event logged", null));
        } catch (Exception e) {
            log.error("Failed to log security event", e);
            return ResponseEntity.badRequest().body(ApiResponse.error("Failed to log security event", e.getMessage()));
        }
    }

    private String getClientIpAddress(HttpServletRequest request) {
        // Check various headers for real client IP (in order of preference)
        // 1. X-Forwarded-For (may contain multiple IPs, first is client)
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }

        // 2. X-Real-IP (set by Nginx/reverse proxy)
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }

        // 3. clientIp (sent directly from frontend as JSON body field)
        // Note: This is handled in the request body parsing above

        // 4. Fallback to remote address
        String remoteAddr = request.getRemoteAddr();
        // If it's a Docker/internal network IP, try to get better IP
        if (remoteAddr != null && (remoteAddr.startsWith("172.") || remoteAddr.startsWith("192.168.") || remoteAddr.equals("0.0.0.0"))) {
            // Check for Cloudflare or other CDN headers
            String cfConnectingIp = request.getHeader("CF-Connecting-IP");
            if (cfConnectingIp != null && !cfConnectingIp.isBlank()) {
                return cfConnectingIp.trim();
            }
            String trueClientIp = request.getHeader("True-Client-IP");
            if (trueClientIp != null && !trueClientIp.isBlank()) {
                return trueClientIp.trim();
            }
        }

        return remoteAddr;
    }
}

