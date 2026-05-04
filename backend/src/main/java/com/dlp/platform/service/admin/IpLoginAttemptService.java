package com.dlp.platform.service.admin;

import com.dlp.platform.service.audit.AuditService;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service to track login attempts by IP address.
 * Implements exponential backoff for IP freezing:
 * - Level 1 (3 attempts): Freeze 5 minutes
 * - Level 2 (after freeze): Freeze 30 minutes
 * - Level 3: Freeze 2 hours
 * - Level 4: Freeze 6 hours
 * - Level 5: Freeze 12 hours
 * - Level 6: Freeze 24 hours
 * - Level 7+: Permanent block
 * Successful login resets the attempt counter but preserves the freeze level for 24 hours.
 */
@Slf4j
@Service
public class IpLoginAttemptService {

    @Value("${security.ip.max-attempts:3}")
    private int maxAttempts;

    // Exponential backoff freeze durations in minutes
    private static final int[] FREEZE_DURATIONS = {5, 30, 120, 360, 720, 1440}; // 5m, 30m, 2h, 6h, 12h, 24h
    private static final int PERMANENT_BAN_THRESHOLD = FREEZE_DURATIONS.length; // Level 6 (index 5) leads to permanent block

    // IP -> LoginAttemptInfo
    private final Map<String, LoginAttemptInfo> attemptCache = new ConcurrentHashMap<>();
    private static final int MAX_CACHE_SIZE = 10000;
    
    private final ApplicationContext applicationContext;

    public IpLoginAttemptService(ApplicationContext applicationContext) {
        this.applicationContext = applicationContext;
    }

    /**
     * Check if IP is blocked (either frozen or permanently banned)
     */
    public boolean isIpBlocked(String ipAddress) {
        LoginAttemptInfo info = attemptCache.get(ipAddress);
        if (info == null) {
            return false;
        }

        // Check if IP is permanently blocked
        if (info.isBlocked()) {
            return true;
        }

        // Check if IP is frozen
        if (info.isFrozen()) {
            if (LocalDateTime.now().isAfter(info.getFrozenUntil())) {
                // Freeze period expired, unfreeze but keep history for 24h
                info.setFrozen(false);
                info.setFrozenUntil(null);
                log.info("IP {} freeze period (Level {}) expired. Unfrozen but preserved for 24h. Current level: {}", 
                         ipAddress, info.getFreezeLevel(), info.getFreezeLevel());
                return false;
            }
            return true; // Still frozen
        }

        return false;
    }

    /**
     * Record a failed login attempt.
     * Returns a FreezeResult containing the current state and whether a freeze/block occurred.
     */
    public FreezeResult recordFailedAttempt(String ipAddress, String accountId) {
        LoginAttemptInfo info = attemptCache.computeIfAbsent(ipAddress, k -> new LoginAttemptInfo());
        FreezeResult result = new FreezeResult();

        // If already permanently blocked
        if (info.isBlocked()) {
            result.setBlocked(true);
            result.setMessage("IP is permanently blocked. Contact administrator.");
            log.warn("IP {} is permanently blocked, ignoring new attempt", ipAddress);
            applicationContext.getBean(AuditService.class).logIpSecurityEvent(ipAddress, accountId, "IP_PERMANENTLY_BLOCKED", "WARNING", 
                    "Attempt while permanently blocked. Total attempts: " + info.getTotalAttempts(), 
                    null, null);
            return result;
        }

        // If currently frozen
        if (info.isFrozen()) {
            if (LocalDateTime.now().isAfter(info.getFrozenUntil())) {
                // Freeze just expired, unfreeze but preserve level
                info.setFrozen(false);
                info.setFrozenUntil(null);
                log.info("IP {} freeze (Level {}) just expired. Attempting again.", ipAddress, info.getFreezeLevel());
            } else {
                // Still frozen, don't increment attempts
                result.setFrozen(true);
                result.setFreezeLevel(info.getFreezeLevel());
                result.setFreezeUntil(info.getFrozenUntil());
                result.setRemainingMinutes(getRemainingFreezeMinutes(ipAddress));
                result.setMessage("IP is currently frozen for " + result.getRemainingMinutes() + " minutes due to repeated failures.");
                log.warn("IP {} is frozen (Level {}), ignoring attempt. Remaining: {} minutes", 
                         ipAddress, info.getFreezeLevel(), result.getRemainingMinutes());
                
                applicationContext.getBean(AuditService.class).logIpSecurityEvent(ipAddress, accountId, "IP_FROZEN_ATTEMPT", "WARNING", 
                        "Attempt while frozen. Level: " + info.getFreezeLevel() + 
                        ". Remaining: " + result.getRemainingMinutes() + " minutes.", 
                        info.getFreezeLevel(), info.getFrozenUntil());
                return result;
            }
        }

        // Increment attempt count
        info.incrementAttempts();
        info.setLastAttempt(LocalDateTime.now());

        log.info("IP {} failed login attempt for account: {}. Count: {}/{} (Level: {})", 
                 ipAddress, accountId, info.getAttemptCount(), maxAttempts, info.getFreezeLevel());

        applicationContext.getBean(AuditService.class).logIpSecurityEvent(ipAddress, accountId, "LOGIN_FAILURE", "INFO", 
                "Failed attempt. Count: " + info.getAttemptCount() + "/" + maxAttempts + 
                ". Freeze Level: " + info.getFreezeLevel(), info.getFreezeLevel(), null);

        // Check if reached max attempts for current cycle
        if (info.getAttemptCount() >= maxAttempts) {
            int currentLevel = info.getFreezeLevel();
            
            if (currentLevel >= PERMANENT_BAN_THRESHOLD) {
                // Permanent ban
                info.setBlocked(true);
                info.setBlockedAt(LocalDateTime.now());
                info.setTotalAttempts(info.getTotalAttempts() + info.getAttemptCount());
                
                log.warn("IP {} PERMANENTLY BLOCKED after {} total failed attempts (Level: {})", 
                         ipAddress, info.getTotalAttempts(), currentLevel);
                
                applicationContext.getBean(AuditService.class).logIpSecurityEvent(ipAddress, accountId, "IP_PERMANENTLY_BLOCKED", "CRITICAL", 
                        "IP permanently blocked. Total attempts: " + info.getTotalAttempts() + 
                        ". Final Freeze Level: " + currentLevel, currentLevel, null);
                
                result.setBlocked(true);
                result.setFreezeLevel(currentLevel);
                result.setMessage("IP address has been permanently blocked due to excessive failed login attempts. Contact administrator.");
                return result;
            } else {
                // Apply next freeze level
                int nextFreezeMinutes = FREEZE_DURATIONS[currentLevel];
                info.setFreezeLevel(currentLevel + 1);
                info.setFrozen(true);
                info.setFrozenUntil(LocalDateTime.now().plusMinutes(nextFreezeMinutes));
                info.setTotalAttempts(info.getTotalAttempts() + info.getAttemptCount());
                info.resetAttempts(); // Reset cycle attempts for next level

                log.warn("IP {} frozen (Level {}) for {} minutes after {} total failed attempts", 
                         ipAddress, info.getFreezeLevel(), nextFreezeMinutes, info.getTotalAttempts());

                applicationContext.getBean(AuditService.class).logIpSecurityEvent(ipAddress, accountId, "IP_FROZEN", "WARNING", 
                        "IP frozen. Level: " + info.getFreezeLevel() + 
                        ". Duration: " + nextFreezeMinutes + " minutes." +
                        " Total attempts: " + info.getTotalAttempts(), 
                        info.getFreezeLevel(), info.getFrozenUntil());

                result.setFrozen(true);
                result.setFreezeLevel(info.getFreezeLevel());
                result.setFreezeDurationMinutes(nextFreezeMinutes);
                result.setFreezeUntil(info.getFrozenUntil());
                result.setRemainingMinutes(nextFreezeMinutes);
                result.setTotalAttempts(info.getTotalAttempts());
                result.setMessage("IP address has been frozen for " + nextFreezeMinutes + " minutes. "
                        + "Next violation will result in longer freeze. Total attempts so far: " + info.getTotalAttempts());
                return result;
            }
        }

        return result;
    }

    /**
     * Record a successful login and reset attempt counter.
     * Resets cycle attempts and clears freeze level for legitimate users.
     */
    public void recordSuccessfulLogin(String ipAddress) {
        LoginAttemptInfo info = attemptCache.get(ipAddress);
        if (info != null) {
            info.resetAttempts();
            info.setTotalAttempts(0);  // Reset total attempts on successful login
            info.setFreezeLevel(0);    // Reset freeze level - legitimate user should start fresh
            // Clear frozen status
            if (info.isFrozen()) {
                info.setFrozen(false);
                info.setFrozenUntil(null);
            }
            log.info("IP {} successful login, fully reset tracking (was Level: {})", 
                     ipAddress, info.getFreezeLevel());
        }
    }

    /**
     * Get remaining freeze time in minutes (0 if not frozen)
     */
    public int getRemainingFreezeMinutes(String ipAddress) {
        LoginAttemptInfo info = attemptCache.get(ipAddress);
        if (info == null || !info.isFrozen()) {
            return 0;
        }

        LocalDateTime now = LocalDateTime.now();
        if (now.isAfter(info.getFrozenUntil())) {
            return 0;
        }

        long minutes = java.time.Duration.between(now, info.getFrozenUntil()).toMinutes();
        return (int) Math.max(0, minutes);
    }

    /**
     * Get attempt count for IP
     */
    public int getAttemptCount(String ipAddress) {
        LoginAttemptInfo info = attemptCache.get(ipAddress);
        return info == null ? 0 : info.getAttemptCount();
    }

    /**
     * Get current freeze level for IP
     */
    public int getFreezeLevel(String ipAddress) {
        LoginAttemptInfo info = attemptCache.get(ipAddress);
        return info == null ? 0 : info.getFreezeLevel();
    }

    /**
     * Get detailed IP status for admin dashboard
     */
    public IpStatusInfo getIpStatus(String ipAddress) {
        LoginAttemptInfo info = attemptCache.get(ipAddress);
        if (info == null) {
            return new IpStatusInfo(ipAddress, 0, 0, false, false, null, null, 0);
        }
        return new IpStatusInfo(
            ipAddress,
            info.getAttemptCount(),
            info.getFreezeLevel(),
            info.isFrozen(),
            info.isBlocked(),
            info.getFrozenUntil(),
            info.getBlockedAt(),
            info.getTotalAttempts()
        );
    }

    /**
     * Unblock an IP address (admin only)
     */
    public void unblockIp(String ipAddress) {
        LoginAttemptInfo info = attemptCache.get(ipAddress);
        if (info != null) {
            attemptCache.remove(ipAddress);
            log.info("IP {} fully removed from IP tracking cache by admin. Was frozen={}, blocked={}", 
                     ipAddress, info.isFrozen(), info.isBlocked());
        }
    }

    /**
     * Immediately block an IP address (for UEBA critical events)
     * The block will remain until manually unblocked by admin.
     */
    public void blockIp(String ipAddress, String reason) {
        LoginAttemptInfo info = attemptCache.computeIfAbsent(ipAddress, k -> new LoginAttemptInfo());
        info.setBlocked(true);
        info.setBlockedAt(LocalDateTime.now());
        info.setLastAttempt(LocalDateTime.now());
        log.warn("IP {} IMMEDIATELY BLOCKED by UEBA. Total attempts: {}. Reason: {}", 
                 ipAddress, info.getTotalAttempts(), reason);
        
        applicationContext.getBean(AuditService.class).logIpSecurityEvent(ipAddress, null, "IP_UEBA_BLOCKED", "CRITICAL", 
                "IP immediately blocked by UEBA. Reason: " + reason + 
                ". Total attempts: " + info.getTotalAttempts(), 
                info.getFreezeLevel(), null);
    }

    /**
     * Get blocked IPs info
     */
    public Map<String, IpStatusInfo> getBlockedIps() {
        Map<String, IpStatusInfo> blocked = new ConcurrentHashMap<>();
        attemptCache.forEach((ip, info) -> {
            if (info.isBlocked() || info.isFrozen()) {
                blocked.put(ip, getIpStatus(ip));
            }
        });
        return blocked;
    }

    /**
     * Cleanup expired entries to prevent memory leaks
     */
    @Scheduled(fixedRate = 300000) // Every 5 minutes
    public void cleanupExpiredEntries() {
        LocalDateTime cutoff = LocalDateTime.now().minusHours(24); // Keep entries for 24 hours
        final int[] removed = {0};

        attemptCache.entrySet().removeIf(entry -> {
            LoginAttemptInfo info = entry.getValue();
            // Remove if not blocked/frozen and last activity was more than 24 hours ago
            if (!info.isBlocked() && !info.isFrozen() && 
                info.getLastAttempt() != null && info.getLastAttempt().isBefore(cutoff)) {
                removed[0]++;
                return true;
            }
            return false;
        });

        if (removed[0] > 0) {
            log.debug("Cleaned up {} expired IP login attempt entries", removed[0]);
        }

        // Prevent cache from growing too large
        if (attemptCache.size() > MAX_CACHE_SIZE) {
            log.warn("IP login attempt cache exceeded maximum size ({}), clearing oldest non-critical entries", MAX_CACHE_SIZE);
            attemptCache.entrySet().removeIf(entry -> {
                LoginAttemptInfo info = entry.getValue();
                // Keep blocked IPs and currently frozen IPs
                return !info.isBlocked() && !info.isFrozen();
            });
        }
    }

    /**
     * Inner class to track login attempts per IP
     */
    @Data
    private static class LoginAttemptInfo {
        private int attemptCount = 0;          // Attempts in current cycle
        private int totalAttempts = 0;         // Total attempts ever
        private int freezeLevel = 0;           // Current freeze escalation level (0-6)
        private boolean frozen = false;
        private LocalDateTime frozenUntil;
        private boolean blocked = false;
        private LocalDateTime blockedAt;
        private LocalDateTime lastAttempt = LocalDateTime.now();

        public void incrementAttempts() {
            this.attemptCount++;
            this.totalAttempts++;
            this.lastAttempt = LocalDateTime.now();
        }

        public void resetAttempts() {
            this.attemptCount = 0;
            this.lastAttempt = LocalDateTime.now();
        }
    }

    /**
     * Result object for recordFailedAttempt
     */
    @Data
    public static class FreezeResult {
        private boolean frozen = false;
        private boolean blocked = false;
        private int freezeLevel = 0;
        private int freezeDurationMinutes = 0;
        private int remainingMinutes = 0;
        private int totalAttempts = 0;
        private LocalDateTime freezeUntil;
        private String message;
    }

    /**
     * IP Status info for admin dashboard
     */
    @Data
    @RequiredArgsConstructor
    public static class IpStatusInfo {
        private final String ipAddress;
        private final int attemptCount;
        private final int freezeLevel;
        private final boolean frozen;
        private final boolean blocked;
        
        @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
        private final LocalDateTime frozenUntil;
        
        @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
        private final LocalDateTime blockedAt;
        
        private final int totalAttempts;
        
        public String getFreezeLevelDescription() {
            if (blocked) return "PERMANENTLY BLOCKED";
            switch (freezeLevel) {
                case 0: return "Normal (No violations)";
                case 1: return "Level 1 (5 min freeze)";
                case 2: return "Level 2 (30 min freeze)";
                case 3: return "Level 3 (2 hour freeze)";
                case 4: return "Level 4 (6 hour freeze)";
                case 5: return "Level 5 (12 hour freeze)";
                case 6: return "Level 6 (24 hour freeze)";
                default: return "Unknown";
            }
        }
        
        public String getRemainingTimeDescription() {
            if (blocked) return "Indefinite (Permanent)";
            if (!frozen || frozenUntil == null) return "N/A";
            long minutes = java.time.Duration.between(LocalDateTime.now(), frozenUntil).toMinutes();
            if (minutes >= 60) {
                return String.format("%d hours %d minutes", minutes / 60, minutes % 60);
            }
            return minutes + " minutes";
        }
    }
}

