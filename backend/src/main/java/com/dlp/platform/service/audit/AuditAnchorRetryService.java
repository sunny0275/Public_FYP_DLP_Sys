package com.dlp.platform.service.audit;

import com.dlp.platform.entity.AuditLog;
import com.dlp.platform.repository.AuditLogRepository;
import com.dlp.platform.service.BlockchainService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
@Slf4j
@RequiredArgsConstructor
public class AuditAnchorRetryService {

    private final AuditLogRepository auditLogRepository;
    private final BlockchainService blockchainService;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private volatile Map<String, Object> lastRunSummary = null;

    @Value("${dlp.blockchain.audit-anchor-retry.enabled:true}")
    private boolean autoRetryEnabled;

    @Value("${dlp.blockchain.audit-anchor-retry.batch-size:100}")
    private int batchSize;

    @Scheduled(cron = "${dlp.blockchain.audit-anchor-retry.cron:0 */5 * * * ?}")
    public void scheduledRetry() {
        if (!autoRetryEnabled) {
            return;
        }
        retryFailedAnchors("AUTO_SCHEDULED", Math.max(1, batchSize));
    }

    @Transactional
    public Map<String, Object> retryFailedAnchors(String trigger, int limit) {
        if (!running.compareAndSet(false, true)) {
            return Map.of(
                "trigger", trigger,
                "status", "SKIPPED_ALREADY_RUNNING",
                "startedAt", LocalDateTime.now()
            );
        }

        LocalDateTime startedAt = LocalDateTime.now();
        int safeLimit = Math.max(1, Math.min(limit, 1000));
        int success = 0;
        int failed = 0;
        int skippedNoHash = 0;

        try {
            var page = auditLogRepository.findByAnchorStatusOrderByIdAsc("ANCHOR_FAILED", PageRequest.of(0, safeLimit));
            var items = page.getContent();

            for (AuditLog logRow : items) {
                try {
                    if (logRow.getImmutableHash() == null || logRow.getImmutableHash().isBlank()) {
                        skippedNoHash++;
                        continue;
                    }
                    if (!blockchainService.isEnabled()) {
                        break;
                    }

                    String txHash = blockchainService.anchorSignature(logRow.getImmutableHash());
                    if (txHash != null && !txHash.isBlank()) {
                        logRow.setBlockchainTxHash(txHash);
                        logRow.setAnchorStatus("ANCHORED");
                        logRow.setAnchoredAt(LocalDateTime.now());
                    } else {
                        log.error("Retry anchor returned empty txHash for auditLogId={}", logRow.getId());
                        logRow.setAnchorStatus("ANCHOR_FAILED");
                    }
                    auditLogRepository.save(logRow);
                    success++;
                } catch (Exception ex) {
                    failed++;
                    log.warn("Retry anchor failed for auditLogId={}: {}", logRow.getId(), ex.getMessage());
                    logRow.setAnchorStatus("ANCHOR_FAILED");
                    auditLogRepository.save(logRow);
                }
            }

            long remainingFailed = auditLogRepository.countByAnchorStatus("ANCHOR_FAILED");
            Map<String, Object> summary = new LinkedHashMap<>();
            summary.put("trigger", trigger);
            summary.put("status", "DONE");
            summary.put("startedAt", startedAt);
            summary.put("finishedAt", LocalDateTime.now());
            summary.put("requestedLimit", safeLimit);
            summary.put("processed", items.size());
            summary.put("success", success);
            summary.put("failed", failed);
            summary.put("skippedNoHash", skippedNoHash);
            summary.put("remainingAnchorFailed", remainingFailed);
            summary.put("blockchainReady", blockchainService.isEnabled());
            lastRunSummary = summary;
            return summary;
        } finally {
            running.set(false);
        }
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getRetryStatus() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("autoRetryEnabled", autoRetryEnabled);
        status.put("batchSize", Math.max(1, batchSize));
        status.put("running", running.get());
        status.put("blockchainReady", blockchainService.isEnabled());
        status.put("currentAnchorFailed", auditLogRepository.countByAnchorStatus("ANCHOR_FAILED"));
        status.put("lastRun", lastRunSummary);
        return status;
    }
}
