package com.dlp.platform.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.NonNull;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Rate limiting filter for authentication endpoints
 * Limits requests per IP address within a time window
 */
@Slf4j
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    @Value("${rate-limit.login.requests}")
    private int maxRequests;

    @Value("${rate-limit.login.window-seconds}")
    private int windowSeconds;

    // In-memory cache: IP -> RequestAttempts
    // Limited to prevent memory exhaustion
    private final Map<String, RequestAttempts> requestCache = new ConcurrentHashMap<>();
    private static final int MAX_CACHE_SIZE = 10000;

    /**
     * Scheduled cleanup task to prevent memory leaks
     * Runs every 5 minutes to remove expired IP entries
     */
    @Scheduled(fixedRate = 300000) // 5 minutes
    public void cleanupExpiredEntries() {
        AtomicInteger removedCount = new AtomicInteger(0);

        // Remove IPs with no recent attempts
        requestCache.entrySet().removeIf(entry -> {
            entry.getValue().cleanExpiredAttempts(windowSeconds);
            if (entry.getValue().getCount() == 0) {
                removedCount.incrementAndGet();
                return true;
            }
            return false;
        });

        if (removedCount.get() > 0) {
            log.debug("Cleaned up {} expired IP entries from rate limit cache", removedCount.get());
        }
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        // Never rate-limit CORS preflight requests (browsers may send many)
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientIp = getClientIP(request);
        String requestPath = request.getServletPath();

        // Check if rate limit should be applied
        if (shouldRateLimit(requestPath)) {
            // Prevent unbounded cache growth
            if (requestCache.size() >= MAX_CACHE_SIZE) {
                cleanupExpiredEntries();
                // If still at limit after cleanup, reject request (DOS protection)
                if (requestCache.size() >= MAX_CACHE_SIZE) {
                    log.warn("Rate limit cache at maximum capacity. Rejecting request from IP: {}", clientIp);
                    response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
                    response.setContentType("application/json");
                    response.getWriter().write(
                            "{\"success\": false, \"message\": \"Service temporarily unavailable\", " +
                            "\"error\": \"System overloaded\"}"
                    );
                    return;
                }
            }

            RequestAttempts attempts = requestCache.computeIfAbsent(clientIp, k -> new RequestAttempts());

            // Atomically check rate limit and record attempt (prevents race condition)
            if (!attempts.tryAddAttempt(maxRequests, windowSeconds)) {
                log.warn("Rate limit exceeded for IP: {} on path: {}", clientIp, requestPath);
                response.setStatus(429); // HTTP 429 Too Many Requests
                response.setContentType("application/json");
                response.getWriter().write(
                        "{\"success\": false, \"message\": \"Too many requests. Please try again later.\", " +
                        "\"error\": \"Rate limit exceeded\"}"
                );
                return;
            }

            // Proceed with filter chain and, if the request succeeds, reset the counter for this IP
            filterChain.doFilter(request, response);

            // Successful authentication flows should clear the rate-limit counter
            if (response.getStatus() < 400) {
                attempts.clear();
                requestCache.remove(clientIp);
            }
            return;
        }

        filterChain.doFilter(request, response);
    }

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        return !shouldRateLimit(request.getServletPath());
    }

    /**
     * Determine if rate limiting should apply to this path
     * Note: servletPath does not include context-path (e.g., /api), so we check without it
     */
    private boolean shouldRateLimit(String path) {
        return path.startsWith("/auth/login") ||
               path.startsWith("/auth/mfa/verify") ||
               path.startsWith("/auth/change-password");
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

    /**
     * Inner class to track request attempts per IP
     * Thread-safe with synchronized methods to prevent race conditions
     */
    private static class RequestAttempts {
        private final ConcurrentHashMap<LocalDateTime, Boolean> attempts = new ConcurrentHashMap<>();

        /**
         * Atomically check rate limit and add attempt if allowed
         * Prevents race condition where multiple threads could bypass limit
         * @param maxRequests Maximum allowed requests
         * @param windowSeconds Time window in seconds
         * @return true if request allowed, false if rate limit exceeded
         */
        public synchronized boolean tryAddAttempt(int maxRequests, int windowSeconds) {
            // Clean expired attempts first
            cleanExpiredAttempts(windowSeconds);

            // Check if limit would be exceeded
            if (attempts.size() >= maxRequests) {
                return false;  // Rate limit exceeded
            }

            // Add this attempt
            attempts.put(LocalDateTime.now(), Boolean.TRUE);
            return true;  // Request allowed
        }

        public synchronized int getCount() {
            return attempts.size();
        }

        public synchronized void cleanExpiredAttempts(int windowSeconds) {
            LocalDateTime cutoff = LocalDateTime.now().minusSeconds(windowSeconds);
            attempts.entrySet().removeIf(entry -> entry.getKey().isBefore(cutoff));
        }

        public synchronized void clear() {
            attempts.clear();
        }
    }
}
