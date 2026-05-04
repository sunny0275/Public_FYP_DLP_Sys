package com.dlp.platform.service.key;

import com.dlp.platform.entity.User;
import com.dlp.platform.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Phase 05: Anomaly detection for key self-destruct trigger.
 * Evaluates risk score from login failures, etc.; triggers key revocation when threshold exceeded.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AnomalyDetectionService {

    @Value("${dlp.key-management.anomaly.revoke-threshold:0.8}")
    private double revokeThreshold;

    @Value("${dlp.key-management.anomaly.failed-login-weight:5}")
    private int failedLoginWeight;

    private final UserRepository userRepository;
    private final KeyManagementService keyManagementService;

    /**
     * Evaluate risk score (0.0–1.0) for user based on login attempts and other signals.
     */
    public double evaluateRiskScore(Long userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return 0;

        int attempts = user.getLoginAttempts() != null ? user.getLoginAttempts() : 0;
        double loginScore = Math.min(1.0, attempts * 0.2); // 5+ failures => 1.0

        return loginScore;
    }

    /**
     * If risk score exceeds threshold and user has a key, revoke it (self-destruct).
     */
    public void triggerRevokeIfNeeded(Long userId, String reason, String ipAddress) {
        if (!keyManagementService.isEnabled() || !keyManagementService.hasKey(userId)) {
            return;
        }
        double score = evaluateRiskScore(userId);
        if (score >= revokeThreshold) {
            log.warn("Anomaly threshold exceeded for user {} (score={}), revoking key", userId, score);
            keyManagementService.revokeKey(userId, reason != null ? reason : "ANOMALY_DETECTED", "SYSTEM", ipAddress);
        }
    }
}
