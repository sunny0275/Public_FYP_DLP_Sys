package com.dlp.platform.service.audit;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
@Slf4j
@RequiredArgsConstructor
public class AuditChainGuardianService {

    private static final Set<String> RECOVERABLE_CODES = Set.of(
        "MISSING_BLOCKCHAIN_TX",
        "ANCHOR_STATUS_NOT_ANCHORED",
        "ONCHAIN_VERIFY_FAILED",
        "ONCHAIN_VERIFY_ERROR"
    );

    private static final Set<String> CRITICAL_CODES = Set.of(
        "HASH_MISMATCH",
        "MISSING_IMMUTABLE_HASH",
        "DUPLICATE_BLOCKCHAIN_TX",
        "HASH_COMPUTE_ERROR"
    );

    private final AuditService auditService;
    private final AuditAnchorRetryService auditAnchorRetryService;
    private final ApplicationEventPublisher eventPublisher;
    private final com.dlp.platform.repository.UserRepository userRepository;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private volatile Map<String, Object> lastStatus = null;

    @Value("${dlp.audit.chain.guardian.enabled:true}")
    private boolean enabled;

    @Value("${dlp.audit.chain.guardian.verify-on-chain:true}")
    private boolean verifyOnChain;

    @Value("${dlp.audit.chain.guardian.max-violations:200}")
    private int maxViolations;

    @Value("${dlp.audit.chain.guardian.auto-retry-recoverable:true}")
    private boolean autoRetryRecoverable;

    @Value("${dlp.audit.chain.guardian.retry-limit:100}")
    private int retryLimit;

    @Scheduled(cron = "${dlp.audit.chain.guardian.cron:0 */1 * * * ?}")
    public void scheduledGuard() {
        if (!enabled) return;
        runGuardCheck("AUTO_SCHEDULED");
    }

    public Map<String, Object> runGuardCheck(String trigger) {
        if (!running.compareAndSet(false, true)) {
            return Map.of(
                "trigger", trigger,
                "status", "SKIPPED_ALREADY_RUNNING",
                "at", LocalDateTime.now()
            );
        }

        LocalDateTime startedAt = LocalDateTime.now();
        try {
            Map<String, Object> verify = auditService.verifyChain(verifyOnChain, maxViolations);
            boolean ok = Boolean.TRUE.equals(verify.get("ok"));

            int recoverable = 0;
            int critical = 0;
            List<Map<String, Object>> violations = castViolations(verify.get("violations"));
            for (Map<String, Object> v : violations) {
                String code = v.get("code") != null ? String.valueOf(v.get("code")) : "";
                if (RECOVERABLE_CODES.contains(code)) recoverable++;
                if (CRITICAL_CODES.contains(code)) critical++;
            }

            // MISSING_BLOCKCHAIN_TX means the audit log has no blockchain txHash.
            // This is expected for logs created before blockchain was enabled/working.
            // Only real integrity violations (HASH_MISMATCH, MISSING_IMMUTABLE_HASH) are truly critical.
            // Exclude MISSING_BLOCKCHAIN_TX from critical count when blockchain is enabled.
            boolean blockchainEnabled = auditService.isBlockchainEnabledForGuardian();
            if (blockchainEnabled) {
                int blockchainMissingCount = 0;
                for (Map<String, Object> v : violations) {
                    String code = v.get("code") != null ? String.valueOf(v.get("code")) : "";
                    if ("MISSING_BLOCKCHAIN_TX".equals(code)) blockchainMissingCount++;
                }
                if (blockchainMissingCount > 0) {
                    recoverable += blockchainMissingCount;
                    critical = Math.max(0, critical - blockchainMissingCount);
                    log.warn("Guardian: {} MISSING_BLOCKCHAIN_TX excluded from critical (blockchain is enabled, " +
                            "these are historical records created before blockchain anchoring was working)",
                            blockchainMissingCount);
                }
            } else if (!verifyOnChain) {
                // Blockchain disabled AND verify-on-chain disabled: all violations are expected.
                int blockchainMissingCount = 0;
                for (Map<String, Object> v : violations) {
                    String code = v.get("code") != null ? String.valueOf(v.get("code")) : "";
                    if ("MISSING_BLOCKCHAIN_TX".equals(code)) blockchainMissingCount++;
                }
                if (blockchainMissingCount > 0) {
                    recoverable += blockchainMissingCount;
                    critical = Math.max(0, critical - blockchainMissingCount);
                    log.debug("Guardian: {} MISSING_BLOCKCHAIN_TX excluded from critical (verify-on-chain=false)",
                            blockchainMissingCount);
                }
            }

            Map<String, Object> summary = new LinkedHashMap<>();
            summary.put("trigger", trigger);
            summary.put("startedAt", startedAt);
            summary.put("finishedAt", LocalDateTime.now());
            summary.put("ok", ok);
            summary.put("verifyOnChain", verifyOnChain);
            summary.put("violationCount", violations.size());
            summary.put("recoverableCount", recoverable);
            summary.put("criticalCount", critical);
            summary.put("criticalCompromised", critical > 0);
            summary.put("verification", verify);

            if (!ok && autoRetryRecoverable && recoverable > 0) {
                Map<String, Object> retry = auditAnchorRetryService.retryFailedAnchors("CHAIN_GUARDIAN_AUTO", retryLimit);
                summary.put("autoRetryTriggered", true);
                summary.put("autoRetryResult", retry);
            } else {
                summary.put("autoRetryTriggered", false);
            }

            if (critical > 0) {
                log.error("CRITICAL: audit chain compromised. criticalViolations={} trigger={}", critical, trigger);

                // Extract specific HASH_MISMATCH IDs for detailed reporting
                StringBuilder tamperedIds = new StringBuilder();
                int hashMismatchCount = 0;
                for (Map<String, Object> v : violations) {
                    String code = v.get("code") != null ? String.valueOf(v.get("code")) : "";
                    if ("HASH_MISMATCH".equals(code)) {
                        Long logId = v.get("logId") != null ? (Long) v.get("logId") : 0;
                        if (hashMismatchCount > 0) tamperedIds.append(", ");
                        tamperedIds.append("#").append(logId);
                        hashMismatchCount++;
                        // Limit to first 10 IDs to keep alert concise
                        if (hashMismatchCount >= 10) {
                            tamperedIds.append("...");
                            break;
                        }
                    }
                }

                // Build detailed message for log only
                String details = violations.size() + " total violations";
                if (hashMismatchCount > 0) {
                    details = "HASH_MISMATCH detected on: " + tamperedIds + " (" + hashMismatchCount + " tampered records)";
                }

                // DO NOT publish ChainGuardianAlertEvent — these are internal integrity checks.
                // Writing them to the audit log creates phantom UEBA incidents attributed to
                // admin users, polluting the dashboard and triggering false UEBA alerts.
                // The chain guardian still logs at ERROR level for operator visibility.
                log.error("Audit chain integrity failure: {} | Details: {}", details, violations);
            } else if (!ok) {
                log.warn("Audit chain has recoverable inconsistencies. recoverable={} trigger={}", recoverable, trigger);
            }

            lastStatus = summary;
            return summary;
        } finally {
            running.set(false);
        }
    }

    public Map<String, Object> getStatus() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("enabled", enabled);
        status.put("running", running.get());
        status.put("verifyOnChain", verifyOnChain);
        status.put("maxViolations", maxViolations);
        status.put("autoRetryRecoverable", autoRetryRecoverable);
        status.put("retryLimit", retryLimit);
        status.put("lastStatus", lastStatus);
        return status;
    }

    /**
     * Resolve a real user ID and accountId for system-level audit events.
     * Uses the first available ADMIN account so the event is attributed to a real user
     * rather than the sentinel "SYSTEM" accountId (which does not exist as a User entity
     * and therefore causes confusion in the UEBA dashboard).
     */
    private Map<String, String> resolveSystemGuardianUser() {
        return userRepository.findAll().stream()
                .filter(u -> u.getDeletedAt() == null
                        && Boolean.TRUE.equals(u.getAccountEnabled())
                        && u.getRoles() != null
                        && u.getRoles().contains("ADMIN"))
                .findFirst()
                .map(u -> Map.of(
                        "userId", String.valueOf(u.getId()),
                        "accountId", u.getAccountId()))
                .orElseGet(() -> Map.of(
                        "userId", "",
                        "accountId", "SYSTEM_GUARDIAN"));
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> castViolations(Object raw) {
        if (raw instanceof List<?> list) {
            return (List<Map<String, Object>>) list;
        }
        return List.of();
    }
}
