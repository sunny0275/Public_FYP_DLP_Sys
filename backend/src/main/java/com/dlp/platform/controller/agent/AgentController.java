package com.dlp.platform.controller.agent;

import com.dlp.platform.entity.User;
import com.dlp.platform.repository.UserRepository;
import com.dlp.platform.service.audit.AuditService;
import com.dlp.platform.service.ueba.UebaScoreService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Agent Controller - Handles events reported by Electron desktop agent.
 * Captures endpoint security events like screenshot/recording detection.
 * 
 * Supports two authentication modes:
 * 1. JWT-authenticated: User info extracted from JWT token (preferred)
 * 2. Endpoint-only: accountId passed in request body (fallback for unauthenticated)
 */
@Slf4j
@RestController
@RequestMapping("/agent/endpoint")
@RequiredArgsConstructor
public class AgentController {

    private final AuditService auditService;
    private final UebaScoreService uebaScoreService;
    private final UserRepository userRepository;

    /**
     * Receive security events from Electron desktop agent.
     * Events include: screenshot attempts, recording detection, USB events, etc.
     * 
     * If JWT token is provided, user info is extracted from the authenticated context.
     * Otherwise, falls back to accountId in request body (for unauthenticated endpoint).
     */
    @PostMapping("/events")
    public ResponseEntity<Map<String, Object>> receiveEndpointEvent(
            @RequestBody Map<String, Object> event,
            HttpServletRequest request) {
        
        try {
            // Attempt JWT-based authentication first (preferred)
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            Long jwtUserId = null;
            String jwtAccountId = null;
            boolean isJwtAuthenticated = false;
            
            if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
                // Extract from JWT auth context
                // The principal is typically the accountId string from our JWT filter
                jwtAccountId = auth.getName();
                jwtUserId = extractUserIdFromAccountId(jwtAccountId);
                isJwtAuthenticated = true;
                log.debug("Endpoint event authenticated via JWT: accountId={}", jwtAccountId);
            }
            
            String action = (String) event.get("action");
            String category = (String) event.get("category");
            String result = (String) event.get("result");
            String severity = (String) event.get("severity"); // Optional override
            String details = (String) event.get("details");
            String bodyAccountId = (String) event.get("accountId"); // Fallback if no JWT
            
            // Use JWT-based auth if available, otherwise fall back to body accountId
            Long resolvedUserId = jwtUserId;
            String resolvedAccountId = isJwtAuthenticated ? jwtAccountId : bodyAccountId;
            
            // If not JWT authenticated and body has accountId, resolve userId
            if (!isJwtAuthenticated && bodyAccountId != null && !bodyAccountId.isBlank()) {
                User user = userRepository.findByAccountIdIgnoreCase(bodyAccountId).orElse(null);
                if (user != null) {
                    resolvedUserId = user.getId();
                    resolvedAccountId = user.getAccountId();
                    log.debug("Endpoint event user resolved from body: {} (id={})", resolvedAccountId, resolvedUserId);
                } else {
                    log.warn("Endpoint event from unknown accountId: {}", bodyAccountId);
                }
            }

            // Append host/user info to details if not already included
            String hostName = (String) event.get("hostName");
            if (details != null && !details.startsWith("host=")) {
                details = "host=" + (hostName != null ? hostName : "unknown") 
                    + " user=" + (resolvedAccountId != null ? resolvedAccountId : "unknown") 
                    + " | " + details;
            }

            // Get client IP - prefer body ipAddress (Electron sends actual local IP)
            // over HTTP header IP (which may be Docker container IP)
            String bodyIpAddress = (String) event.get("ipAddress");
            String ipAddress;
            if (bodyIpAddress != null && !bodyIpAddress.isBlank()
                    && !"127.0.0.1".equals(bodyIpAddress) && !"0.0.0.0".equals(bodyIpAddress)) {
                ipAddress = bodyIpAddress;
                log.debug("Using ipAddress from Electron body: {}", ipAddress);
            } else {
                ipAddress = getClientIp(request);
            }
            
            // Log security event to audit trail
            // Note: If JWT authenticated, jwtAccountId and jwtUserId are used
            // This ensures audit logs are associated with the correct authenticated user
            auditService.logEndpointSecurityEvent(
                action,
                category,
                result,
                severity, // Optional severity override (null = auto-calculate)
                details != null ? details : "",
                resolvedAccountId, // username field in service (will be prefixed to details)
                hostName,
                ipAddress,
                resolvedUserId,
                resolvedAccountId
            );

            log.info("Endpoint security event: action={}, category={}, result={}, accountId={}, isJwtAuth={}, host={}, ip={}",
                action, category, result, resolvedAccountId, isJwtAuthenticated, hostName, ipAddress);

            return ResponseEntity.ok(Map.of(
                "status", "received",
                "action", action != null ? action : "unknown",
                "authenticated", isJwtAuthenticated,
                "accountId", resolvedAccountId != null ? resolvedAccountId : "unknown"
            ));
        } catch (Exception e) {
            log.error("Failed to process endpoint event: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                "status", "error",
                "message", e.getMessage()
            ));
        }
    }
    
    /**
     * Extract userId from accountId by looking up in UserRepository.
     */
    private Long extractUserIdFromAccountId(String accountId) {
        if (accountId == null || accountId.isBlank()) return null;
        return userRepository.findByAccountIdIgnoreCase(accountId)
            .map(User::getId)
            .orElse(null);
    }
    
    /**
     * Extract client IP address from request.
     */
    private String getClientIp(HttpServletRequest request) {
        String[] headers = {"X-Forwarded-For", "Proxy-Client-IP", "WL-Proxy-Client-IP", 
            "HTTP_X_FORWARDED_FOR", "HTTP_X_FORWARDED", "REMOTE_ADDR"};
        for (String header : headers) {
            String ip = request.getHeader(header);
            if (ip != null && !ip.isEmpty() && !"unknown".equalsIgnoreCase(ip)) {
                if (ip.contains(",")) ip = ip.split(",")[0].trim();
                return ip;
            }
        }
        return request.getRemoteAddr();
    }

    /**
     * Health check endpoint for agent connectivity.
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> healthCheck() {
        return ResponseEntity.ok(Map.of(
            "status", "healthy",
            "service", "agent-endpoint-receiver"
        ));
    }
}
