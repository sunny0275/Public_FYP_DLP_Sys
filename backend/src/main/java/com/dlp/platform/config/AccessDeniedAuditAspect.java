package com.dlp.platform.config;

import com.dlp.platform.entity.User;
import com.dlp.platform.service.audit.AuditService;
import com.dlp.platform.service.ueba.UebaScoreService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterThrowing;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * AOP Aspect for logging AccessDeniedException to audit log and triggering UEBA score deduction.
 * 
 * This is a SAFETY NET - the primary handler is GlobalExceptionHandler.
 * This Aspect ensures that even if the exception escapes the handler,
 * we still capture the security event.
 * 
 * NOTE: This aspect intercepts exceptions thrown FROM controller methods.
 * If the exception is caught and handled by GlobalExceptionHandler,
 * only ONE of them will log (whichever executes first).
 */
@Aspect
@Component
@Slf4j
@RequiredArgsConstructor
public class AccessDeniedAuditAspect {

    private final AuditService auditService;
    private final UebaScoreService uebaScoreService;

    /**
     * Pointcut for all controller methods (Service layer exceptions propagate to controllers)
     */
    @Pointcut("execution(* com.dlp.platform.controller..*.*(..))")
    public void controllerMethods() {}

    /**
     * Intercept AccessDeniedException and log to audit + trigger UEBA.
     * This is called when AccessDeniedException escapes from a controller method
     * (before GlobalExceptionHandler processes it).
     */
    @AfterThrowing(pointcut = "controllerMethods()", throwing = "ex")
    public void handleAccessDeniedException(JoinPoint joinPoint, AccessDeniedException ex) {
        try {
            // Get current user from multiple sources (in order of preference):
            // 1. Request attribute set by JwtAuthenticationFilter (most reliable)
            // 2. Security context (set by Spring Security)
            // 3. Principal from authentication
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            User currentUser = null;
            HttpServletRequest request = null;
            String ipAddress = "UNKNOWN";
            String resource = "UNKNOWN";

            if (attributes != null) {
                request = attributes.getRequest();
                currentUser = (User) request.getAttribute("currentUser");
                ipAddress = getClientIp(request);
                resource = getResourceFromJoinPoint(joinPoint, request);

                // Fallback: try Security context
                if (currentUser == null) {
                    var authentication = SecurityContextHolder.getContext().getAuthentication();
                    if (authentication != null && authentication.getPrincipal() instanceof User) {
                        currentUser = (User) authentication.getPrincipal();
                    }
                }
            }

            if (currentUser == null) {
                Object principal = request != null ? request.getUserPrincipal() : null;
                if (principal == null) {
                    principal = SecurityContextHolder.getContext().getAuthentication();
                }
                if (principal instanceof org.springframework.security.core.Authentication auth) {
                    log.warn("No User object found for AccessDeniedException audit, principal: {}", auth.getPrincipal());
                }
            }

            String methodSignature = joinPoint.getSignature().toShortString();
            log.debug("AccessDeniedException intercepted by aspect for method: {}", methodSignature);

            // Log to audit
            if (currentUser != null) {
                auditService.logEvent(
                    currentUser.getId(),
                    currentUser.getAccountId(),
                    "UNAUTHORIZED_ACCESS",
                    "SECURITY",
                    "DENIED",
                    "Access denied to resource: " + resource + ". Reason: " + ex.getMessage(),
                    ipAddress,
                    request != null ? request.getHeader("User-Agent") : null,
                    request != null ? request.getHeader("X-Device-Fingerprint") : null
                );

                // Trigger UEBA score deduction for unauthorized access attempt
                try {
                    uebaScoreService.deductForFailure(
                        currentUser.getId(),
                        currentUser.getAccountId(),
                        "Unauthorized access attempt to: " + resource + ". Reason: " + ex.getMessage(),
                        ipAddress
                    );
                } catch (Exception uebaEx) {
                    log.error("Failed to record unauthorized access in UEBA: {}", uebaEx.getMessage());
                }

                log.warn("SECURITY [ASPECT]: Unauthorized access attempt by user {} to resource {} from IP {}. Reason: {}",
                    currentUser.getAccountId(), resource, ipAddress, ex.getMessage());
            } else {
                // Anonymous or unknown user - still log for security monitoring
                auditService.logEvent(
                    null,
                    "ANONYMOUS",
                    "UNAUTHORIZED_ACCESS",
                    "SECURITY",
                    "DENIED",
                    "Anonymous access denied to resource: " + resource + ". Reason: " + ex.getMessage(),
                    ipAddress,
                    request != null ? request.getHeader("User-Agent") : null,
                    request != null ? request.getHeader("X-Device-Fingerprint") : null
                );

                log.warn("SECURITY [ASPECT]: Anonymous unauthorized access attempt to resource {} from IP {}. Reason: {}",
                    resource, ipAddress, ex.getMessage());
            }
        } catch (Exception e) {
            log.error("Error in AccessDeniedAuditAspect: {}", e.getMessage(), e);
        }
    }

    /**
     * Extract client IP from request, checking common proxy headers
     */
    private String getClientIp(HttpServletRequest request) {
        if (request == null) {
            return "UNKNOWN";
        }
        
        String[] headerNames = {
            "X-Forwarded-For",
            "Proxy-Client-IP",
            "WL-Proxy-Client-IP",
            "HTTP_X_FORWARDED_FOR",
            "HTTP_X_FORWARDED",
            "HTTP_X_CLUSTER_CLIENT_IP",
            "HTTP_CLIENT_IP",
            "HTTP_FORWARDED_FOR",
            "HTTP_FORWARDED",
            "HTTP_VIA",
            "REMOTE_ADDR"
        };

        for (String header : headerNames) {
            String ip = request.getHeader(header);
            if (ip != null && !ip.isEmpty() && !"unknown".equalsIgnoreCase(ip)) {
                if (ip.contains(",")) {
                    ip = ip.split(",")[0].trim();
                }
                return ip;
            }
        }
        return request.getRemoteAddr();
    }

    /**
     * Extract resource identifier from join point and request
     */
    private String getResourceFromJoinPoint(JoinPoint joinPoint, HttpServletRequest request) {
        StringBuilder resourceInfo = new StringBuilder();
        
        // First, try to get full path from request
        if (request != null) {
            resourceInfo.append(request.getRequestURI());
            if (request.getQueryString() != null) {
                resourceInfo.append("?").append(request.getQueryString());
            }
        }
        
        // Then add method info
        if (joinPoint != null) {
            String className = joinPoint.getTarget().getClass().getSimpleName();
            String methodName = joinPoint.getSignature().getName();
            
            if (resourceInfo.length() > 0) {
                resourceInfo.append(" -> ");
            }
            resourceInfo.append(className).append(".").append(methodName);
            
            // Try to extract ID from arguments
            Object[] args = joinPoint.getArgs();
            for (Object arg : args) {
                if (arg instanceof Long) {
                    resourceInfo.append(" [id=").append(arg).append("]");
                    break;
                } else if (arg instanceof String && ((String) arg).matches("\\d+")) {
                    resourceInfo.append(" [id=").append(arg).append("]");
                    break;
                }
            }
        }

        return resourceInfo.toString();
    }
}
