package com.dlp.platform.service.admin;

import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tracks brute force attacks on individual accounts across multiple IPs.
 * When multiple different IPs attempt to brute-force the same account,
 * the account is automatically disabled as a security measure.
 *
 * This is separate from IP-based freezing (IpLoginAttemptService) which
 * tracks attacks originating from a single IP.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AccountBruteForceTrackerService {

    @Value("${security.account.brute-force.threshold:3}")
    private int bruteForceThreshold;

    @Value("${security.account.brute-force.window-hours:1}")
    private int bruteForceWindowHours;

    // For testing: bypass IP uniqueness check (simulate multi-IP attack from single IP)
    @Value("${security.account.brute-force.test-mode:false}")
    private boolean testMode;

    // Account ID -> AccountAttemptInfo
    private final Map<String, AccountAttemptInfo> accountAttemptCache = new ConcurrentHashMap<>();

    /**
     * Record a failed login attempt from an IP for a specific account.
     * Returns true if the account should be disabled due to multi-IP brute force.
     */
    public boolean recordFailedAttempt(String accountId, String ipAddress) {
        AccountAttemptInfo info = accountAttemptCache.computeIfAbsent(accountId, k -> new AccountAttemptInfo());
        
        if (testMode) {
            // In test mode, each failed attempt counts as a unique IP
            // This allows testing the disable feature from a single IP
            info.addTestAttempt();
            log.debug("TEST MODE: Account {} brute force count: {} (simulating multi-IP attack)", 
                    accountId, info.getUniqueIpCount());
        } else {
            info.addIp(ipAddress);
        }

        log.debug("Account {} has failed attempts from {} unique IPs: {}", 
                accountId, info.getUniqueIpCount(), info.getIpAddresses());

        // Check if threshold exceeded
        if (info.getUniqueIpCount() >= bruteForceThreshold) {
            log.warn("Account {} is under brute force attack! {} unique IPs/attempts detected. Disabling account.",
                    accountId, info.getUniqueIpCount());
            return true;
        }

        return false;
    }

    /**
     * Clear tracking for an account (e.g., after successful login or admin reset)
     */
    public void clearTracking(String accountId) {
        accountAttemptCache.remove(accountId);
        log.info("Cleared brute force tracking for account: {}", accountId);
    }

    /**
     * Get unique IP count for an account
     */
    public int getUniqueIpCount(String accountId) {
        AccountAttemptInfo info = accountAttemptCache.get(accountId);
        return info != null ? info.getUniqueIpCount() : 0;
    }

    /**
     * Check if account is being tracked for brute force
     */
    public boolean isTracked(String accountId) {
        return accountAttemptCache.containsKey(accountId);
    }

    /**
     * Inner class to track attempted IPs per account
     */
    @Data
    private static class AccountAttemptInfo {
        private final Set<String> ipAddresses = ConcurrentHashMap.newKeySet();
        private int testAttemptCount = 0;  // For test mode simulation
        private LocalDateTime firstAttempt = LocalDateTime.now();

        public void addIp(String ip) {
            ipAddresses.add(ip);
        }
        
        public void addTestAttempt() {
            // In test mode, each call counts as a separate "IP" for simulation
            testAttemptCount++;
        }

        public int getUniqueIpCount() {
            // In test mode, return simulated count instead of actual IPs
            if (testAttemptCount > 0) {
                return testAttemptCount;
            }
            return ipAddresses.size();
        }

        public Set<String> getIpAddresses() {
            return ipAddresses;
        }
    }
}
