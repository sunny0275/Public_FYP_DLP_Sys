package com.dlp.platform.service.admin;

import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tracks user login IP patterns for security monitoring.
 * 
 * Records each user's known IP prefixes (/24) and logs unusual login locations
 * for admin review. Does NOT block or disable accounts - MFA provides protection.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IpPatternTrackerService {

    /**
     * Per-user IP tracking data
     */
    @Data
    public static class UserIpProfile {
        private final String accountId;
        private final Set<String> knownIpPrefixes = ConcurrentHashMap.newKeySet();  // /24 prefixes
        private final List<IpLoginRecord> recentLogins = Collections.synchronizedList(new ArrayList<>());
        private LocalDateTime firstLogin;
        private LocalDateTime lastLogin;
        private int totalLogins = 0;
    }

    @Data
    public static class IpLoginRecord {
        private final String ipAddress;
        private final LocalDateTime timestamp;
        private final boolean success;
    }

    /**
     * Result of IP analysis
     */
    @Data
    public static class IpAnalysisResult {
        private final IpRiskLevel riskLevel;
        private final String reason;

        public static IpAnalysisResult safe() {
            return new IpAnalysisResult(IpRiskLevel.SAFE, "Known IP");
        }

        public static IpAnalysisResult unusual(String reason) {
            return new IpAnalysisResult(IpRiskLevel.UNUSUAL, reason);
        }
    }

    public enum IpRiskLevel {
        SAFE,     // Known IP, normal login
        UNUSUAL,  // New IP pattern, logged for admin review
    }

    // Storage: accountId -> UserIpProfile
    private final Map<String, UserIpProfile> userProfiles = new ConcurrentHashMap<>();

    /**
     * Analyze login IP and update user profile.
     * 
     * @param accountId User account ID
     * @param ipAddress Login IP address
     * @param success Whether login was successful
     * @return Analysis result with risk level
     */
    public IpAnalysisResult analyzeAndRecordLogin(String accountId, String ipAddress, boolean success) {
        UserIpProfile profile = userProfiles.computeIfAbsent(accountId, k -> new UserIpProfile(k));
        
        // Record this login
        IpLoginRecord record = new IpLoginRecord(ipAddress, LocalDateTime.now(), success);
        profile.getRecentLogins().add(record);
        profile.setLastLogin(LocalDateTime.now());
        profile.setTotalLogins(profile.getTotalLogins() + 1);
        if (profile.getFirstLogin() == null) {
            profile.setFirstLogin(LocalDateTime.now());
        }

        // Keep only last 100 login records
        while (profile.getRecentLogins().size() > 100) {
            profile.getRecentLogins().remove(0);
        }

        IpAnalysisResult result;
        
        if (profile.getKnownIpPrefixes().isEmpty()) {
            // First login - record this IP
            String prefix = getIpPrefix(ipAddress);
            profile.getKnownIpPrefixes().add(prefix);
            log.info("First login for {} from IP {}, recorded prefix /24: {}", 
                    accountId, ipAddress, prefix);
            result = IpAnalysisResult.safe();
            
        } else {
            // Check if IP matches known patterns
            result = analyzeIp(ipAddress, profile);
            
            // If IP is new, record it for future logins
            if (result.getRiskLevel() == IpRiskLevel.UNUSUAL) {
                String prefix = getIpPrefix(ipAddress);
                profile.getKnownIpPrefixes().add(prefix);
                log.info("New IP prefix {} recorded for {} after unusual login", prefix, accountId);
            }
        }

        return result;
    }

    /**
     * Analyze IP against user's known patterns.
     */
    private IpAnalysisResult analyzeIp(String ipAddress, UserIpProfile profile) {
        String currentPrefix = getIpPrefix(ipAddress);
        boolean knownPrefix = profile.getKnownIpPrefixes().contains(currentPrefix);
        
        if (knownPrefix) {
            return IpAnalysisResult.safe();
        }

        // New IP - just record and log for admin review
        // MFA provides protection, no need to block
        return IpAnalysisResult.unusual(
            "New login from IP " + ipAddress + " (prefix " + currentPrefix + 
            "). Known prefixes: " + profile.getKnownIpPrefixes());
    }

    /**
     * Get /24 prefix from IP (e.g., "192.168.1" from "192.168.1.100")
     */
    private String getIpPrefix(String ipAddress) {
        return getIpPrefix(ipAddress, 24);
    }

    private String getIpPrefix(String ipAddress, int bits) {
        if (ipAddress == null || ipAddress.isBlank()) {
            return "unknown";
        }
        
        // Handle IPv6 or non-standard IPs
        if (!ipAddress.contains(".") || ipAddress.contains(":")) {
            return ipAddress;  // Return as-is for non-IPv4
        }
        
        String[] parts = ipAddress.split("\\.");
        int bytes = bits / 8;
        
        if (parts.length < bytes) {
            return ipAddress;
        }
        
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < bytes; i++) {
            if (i > 0) sb.append(".");
            sb.append(parts[i]);
        }
        return sb.toString();
    }

    /**
     * Get user's known IP prefixes.
     */
    public Set<String> getKnownIpPrefixes(String accountId) {
        UserIpProfile profile = userProfiles.get(accountId);
        return profile != null ? new HashSet<>(profile.getKnownIpPrefixes()) : Collections.emptySet();
    }

    /**
     * Get user's IP profile.
     */
    public UserIpProfile getUserProfile(String accountId) {
        return userProfiles.get(accountId);
    }

    /**
     * Clear user's IP profile (e.g., after account reset).
     */
    public void clearUserProfile(String accountId) {
        userProfiles.remove(accountId);
        log.info("Cleared IP profile for account: {}", accountId);
    }

    /**
     * Get all tracked accounts.
     */
    public Set<String> getTrackedAccounts() {
        return new HashSet<>(userProfiles.keySet());
    }
}
