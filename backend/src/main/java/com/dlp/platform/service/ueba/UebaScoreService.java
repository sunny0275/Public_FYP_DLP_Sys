package com.dlp.platform.service.ueba;

import com.dlp.platform.entity.User;
import com.dlp.platform.repository.UserRepository;
import com.dlp.platform.service.audit.AuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * UEBA score: default 100 per user, deduct on anomaly. Every 10 points = tier.
 * 
 * Scoring Rules:
 * - Default score: 100
 * - Confidence-weighted deduction based on LLM severity and confidence
 * - Score 90-100: OK
 * - Score 70-89: WARNING (LLM UEBA processes)
 * - Score <= 70: CRITICAL (Account DISABLED after 3 lockout cycles)
 * 
 * Example flow (with confidence-weighted scoring):
 * - LLM HIGH (0.9 conf) → 15 * 0.9 = 14 points → 100 - 14 = 86 → WARNING
 * - LLM MEDIUM (0.8 conf) → 10 * 0.8 = 8 points → 86 - 8 = 78 → WARNING  
 * - LLM CRITICAL (0.95 conf) → 25 * 0.95 = 24 points → 78 - 24 = 54 → LOCK
 * - Score <= 70 → DISABLE
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class UebaScoreService {

    private static final int DEFAULT_SCORE = 100;
    private static final int DEDUCT_PER_FREEZE = 10;        // Deduct per IP freeze event (not per failure)
    private static final int TIER_WARNING_ALERT = 90;       // score <= 90 -> alert admin (LLM UEBA)
    private static final int TIER_DISABLE = 70;             // score <= 70 -> disable account (after 3 cycles)

    private final UserRepository userRepository;
    private final AuditService auditService;

    /**
     * Normalize role string to standard format (e.g., "ROLE_ADMIN" -> "ADMIN", "Admin" -> "ADMIN").
     */
    private boolean hasAdminRole(User user) {
        if (user.getRoles() == null || user.getRoles().isEmpty()) {
            return false;
        }
        return user.getRoles().stream()
                .map(role -> {
                    if (role == null) return "";
                    String r = role.trim().toUpperCase();
                    if (r.startsWith("ROLE_")) r = r.substring("ROLE_".length());
                    return r;
                })
                .anyMatch("ADMIN"::equals);
    }

    /**
     * Current UEBA score for user (100 if never set).
     */
    @Transactional(readOnly = true)
    public int getScore(Long userId) {
        if (userId == null) return DEFAULT_SCORE;
        return userRepository.findById(userId)
                .map(u -> u.getUebaScore() != null ? u.getUebaScore() : DEFAULT_SCORE)
                .orElse(DEFAULT_SCORE);
    }

    /**
     * Deduct points for security events.
     * Triggers WARNING alert to admin when score drops to <= 90 (LLM UEBA processes).
     * Disables account when score <= 70 (after 3 lockout cycles).
     * 
     * @param points The number of points to deduct (should be confidence-weighted)
     */
    @Transactional
    public void deduct(Long userId, String accountId, int points, String reason, String ipAddress) {
        if (userId == null) return;
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return;
        
        // Skip UEBA scoring for admin accounts
        if (hasAdminRole(user)) {
            log.debug("Skipping UEBA deduction for admin account {}", accountId);
            return;
        }
        
        int previous = user.getUebaScore() != null ? user.getUebaScore() : DEFAULT_SCORE;
        // Deduct the provided points (confidence-weighted from LLM analysis)
        // Points should already account for severity and confidence
        int next = Math.max(0, previous - points);
        user.setUebaScore(next);
        userRepository.save(user);
        log.info("UEBA deduct: user {} score {} -> {} (deducted {} points, reason: {})", 
                accountId, previous, next, points, reason);

        // Score 90-100: OK
        // Score 70-89: WARNING (LLM UEBA processes)
        // Score <= 70: DISABLE
        if (next <= TIER_WARNING_ALERT && previous > TIER_WARNING_ALERT) {
            auditService.logUebaAction(userId, accountId, "UEBA_WARNING", "WARNING",
                    "UEBA score dropped to " + next + ". " + reason + ". LLM UEBA processing initiated.", ipAddress);
        }
        if (next <= TIER_DISABLE) {
            user.setAccountEnabled(false);
            userRepository.save(user);
            auditService.logUebaAction(userId, accountId, "UEBA_DISABLE", "CRITICAL",
                    "Account disabled: UEBA score " + next + " (<= " + TIER_DISABLE + "). " + reason, ipAddress);
            log.warn("UEBA: account {} DISABLED due to score {} (<= {})", accountId, next, TIER_DISABLE);
        }
    }

    /**
     * Deduct for IP freeze event by accountId (called from AuthService).
     */
    @Transactional
    public void deductForFailureByAccountId(String accountId, String reason, String ipAddress) {
        if (accountId == null || accountId.isBlank()) return;
        userRepository.findByAccountId(accountId).ifPresent(u ->
                deduct(u.getId(), u.getAccountId(), DEDUCT_PER_FREEZE, reason, ipAddress));
    }

    /**
     * Deduct for other audit FAILURE events (e.g., document access denied).
     */
    public void deductForFailure(Long userId, String accountId, String reason, String ipAddress) {
        deduct(userId, accountId, DEDUCT_PER_FREEZE, reason, ipAddress);
    }

    /**
     * Deduct for audit WARNING events.
     */
    public void deductForWarning(Long userId, String accountId, String reason, String ipAddress) {
        deduct(userId, accountId, DEDUCT_PER_FREEZE, reason, ipAddress);
    }

    /**
     * Reset user score to 100 (e.g. after admin review).
     * Admin accounts are EXCLUDED from manual reset (score must remain 100).
     */
    @Transactional
    public void resetScore(Long userId) {
        if (userId == null) return;
        userRepository.findById(userId).ifPresent(u -> {
            // Admin accounts are protected: UEBA score must remain 100
            if (hasAdminRole(u)) {
                log.debug("Skipping reset for admin account {}", u.getAccountId());
                return;
            }
            u.setUebaScore(DEFAULT_SCORE);
            userRepository.save(u);
        });
    }

    /**
     * Immediately disable user account for critical security violations.
     * Used for USB attacks, malware detection, etc.
     * Does NOT trigger UEBA scoring (already handled by caller).
     * Admin accounts are EXCLUDED from immediate disable (score must remain 100).
     */
    @Transactional
    public void disableAccount(Long userId, String accountId, String reason) {
        if (userId == null) return;
        userRepository.findById(userId).ifPresent(u -> {
            // Admin accounts are protected: UEBA score must remain 100
            if (hasAdminRole(u)) {
                log.debug("Skipping immediate disable for admin account {}", accountId);
                return;
            }
            u.setAccountEnabled(false);
            u.setUebaScore(0);  // Force score to 0
            userRepository.save(u);
            auditService.logUebaAction(userId, accountId, "UEBA_DISABLE_IMMEDIATE", "CRITICAL",
                    "Account disabled: " + reason, null);
            log.warn("UEBA IMMEDIATE DISABLE: account {} disabled due to: {}", accountId, reason);
        });
    }
}
