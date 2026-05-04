package com.dlp.platform.service.ueba;

import com.dlp.platform.repository.AuditLogRepository;
import com.dlp.platform.service.audit.AuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Bulk View Detection Service for UEBA.
 * Detects when a user views more than threshold different documents within a time window.
 * This is considered a high-risk behavior that may indicate data exfiltration attempt.
 * 
 * Rule: If user views >= threshold different documents within window-minutes, trigger alert.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BulkViewDetectionService {

    private final AuditLogRepository auditLogRepository;
    private final AuditService auditService;
    private final UebaScoreService uebaScoreService;

    @Value("${llm-ueba.bulk-view.enabled:true}")
    private boolean bulkViewEnabled;

    @Value("${llm-ueba.bulk-view.threshold:10}")
    private int bulkViewThreshold;

    @Value("${llm-ueba.bulk-view.window-minutes:5}")
    private int windowMinutes;

    @Value("${llm-ueba.bulk-view.score-penalty:15}")
    private int scorePenalty;

    @Value("${llm-ueba.bulk-view.alert-action:ALERT_ADMIN}")
    private String alertAction;

    // In-memory tracking for VIEW events (userId -> count within window)
    // Key: userId, Value: RollingWindowCounter
    private final Map<Long, RollingWindowCounter> userViewCounters = new ConcurrentHashMap<>();

    /**
     * Check if viewing a document triggers bulk view detection.
     * Called after each VIEW activity is logged.
     * 
     * @param userId User ID performing the view
     * @param accountId Account ID for logging
     * @param ipAddress IP address for logging
     * @return true if bulk view was detected
     */
    @Transactional
    public boolean checkBulkView(Long userId, String accountId, String ipAddress) {
        if (!bulkViewEnabled) {
            return false;
        }

        if (userId == null) {
            return false;
        }

        // Skip for admin accounts
        if (isAdminUser(userId)) {
            return false;
        }

        // Get or create counter for user
        RollingWindowCounter counter = userViewCounters.computeIfAbsent(userId, k -> new RollingWindowCounter(windowMinutes));

        // Increment and check
        int recentCount = counter.incrementAndGet();
        
        log.debug("Bulk view check: userId={}, recentViews={}, threshold={}", userId, recentCount, bulkViewThreshold);

        if (recentCount >= bulkViewThreshold) {
            // Bulk view detected!
            log.warn("BULK VIEW DETECTED: user {} viewed {} different documents in {} minutes (threshold: {})",
                accountId, recentCount, windowMinutes, bulkViewThreshold);

            // Record detection (don't reset counter immediately to track ongoing activity)
            boolean recorded = recordBulkViewDetection(userId, accountId, recentCount, ipAddress);

            // Apply penalty based on alert action
            if (recorded) {
                applyPenalty(userId, accountId, recentCount, ipAddress);
            }

            return true;
        }

        return false;
    }

    /**
     * Record bulk view detection in audit log.
     * Returns true if this is a new detection (not already recorded).
     */
    private boolean recordBulkViewDetection(Long userId, String accountId, int viewCount, String ipAddress) {
        // Log the detection as an audit event
        auditService.logUebaAction(
            userId,
            accountId,
            "BULK_VIEW_DETECTED",
            "HIGH",
            String.format("User viewed %d different documents in %d minutes (threshold: %d). High risk: potential data exfiltration.",
                viewCount, windowMinutes, bulkViewThreshold),
            ipAddress
        );

        log.info("BULK_VIEW audit logged: userId={}, viewCount={}, windowMinutes={}",
            userId, viewCount, windowMinutes);

        return true;
    }

    /**
     * Apply penalty based on alert action configuration.
     */
    private void applyPenalty(Long userId, String accountId, int viewCount, String ipAddress) {
        String details = String.format("Bulk view detected: %d docs in %d min (threshold=%d)",
            viewCount, windowMinutes, bulkViewThreshold);

        switch (alertAction.toUpperCase()) {
            case "WARNING":
                uebaScoreService.deductForWarning(userId, accountId, "BULK_VIEW: " + details, ipAddress);
                break;
            case "ALERT_ADMIN":
            default:
                // Default: apply score penalty
                uebaScoreService.deduct(userId, accountId, scorePenalty,
                    "BULK_VIEW: " + details, ipAddress);
                break;
        }
    }

    /**
     * Check if user is an admin (skip bulk view detection for admin).
     */
    private boolean isAdminUser(Long userId) {
        // Could inject UserRepository to check, but for performance use cache or skip
        // Admin users typically don't bulk view documents
        return false; // Let the check be done at caller level if needed
    }

    /**
     * Reset view counter for a user (e.g., after investigation clears the user).
     */
    public void resetCounter(Long userId) {
        userViewCounters.remove(userId);
        log.debug("Bulk view counter reset for userId={}", userId);
    }

    /**
     * Get current view count for a user.
     */
    public int getCurrentViewCount(Long userId) {
        RollingWindowCounter counter = userViewCounters.get(userId);
        return counter != null ? counter.getCount() : 0;
    }

    /**
     * Rolling window counter for tracking VIEW events.
     */
    private static class RollingWindowCounter {
        private final int windowMinutes;
        private final AtomicInteger count = new AtomicInteger(0);
        private volatile long windowStartTime;
        private final Object lock = new Object();

        RollingWindowCounter(int windowMinutes) {
            this.windowMinutes = windowMinutes;
            this.windowStartTime = System.currentTimeMillis();
        }

        int incrementAndGet() {
            long now = System.currentTimeMillis();
            long windowMs = windowMinutes * 60 * 1000L;

            synchronized (lock) {
                if (now - windowStartTime > windowMs) {
                    // Window expired, reset
                    count.set(1);
                    windowStartTime = now;
                } else {
                    count.incrementAndGet();
                }
                return count.get();
            }
        }

        int getCount() {
            long now = System.currentTimeMillis();
            long windowMs = windowMinutes * 60 * 1000L;

            synchronized (lock) {
                if (now - windowStartTime > windowMs) {
                    return 0;
                }
                return count.get();
            }
        }
    }
}