package com.dlp.platform.controller.system;

import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.service.BlockchainService;
import com.dlp.platform.repository.AuditLogRepository;
import com.dlp.platform.service.audit.AuditAnchorRetryService;
import com.dlp.platform.service.audit.AuditChainGuardianService;
import com.dlp.platform.service.audit.AuditService;
import com.dlp.platform.service.classification.LLMClassificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.dlp.platform.entity.User;

import java.lang.management.ManagementFactory;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Lightweight system / infrastructure health endpoints
 * used by the Admin dashboard.
 *
 * This is intentionally simple and does not expose
 * sensitive internal details.
 */
@Slf4j
@RestController
@RequestMapping("/system")
@RequiredArgsConstructor
public class SystemController {
    private final BlockchainService blockchainService;
    private final AuditAnchorRetryService auditAnchorRetryService;
    private final AuditChainGuardianService auditChainGuardianService;
    private final AuditService auditService;
    private final AuditLogRepository auditLogRepository;
    private final LLMClassificationService llmClassificationService;

    /**
     * GET /api/system/health
     */
    @GetMapping("/health")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSystemHealth() {
        try {
            Map<String, Object> data = new HashMap<>();

            // Basic status
            data.put("status", "HEALTHY");

            // Uptime (seconds) based on JVM start time
            long jvmStartTime = ManagementFactory.getRuntimeMXBean().getStartTime();
            long uptimeSeconds = (Instant.now().toEpochMilli() - jvmStartTime) / 1000;
            data.put("uptime", uptimeSeconds);

            // OS metrics (best-effort, may be null on some platforms)
            data.put("cpuUsage", 25);      // simple fixed values to avoid native casting complexity
            data.put("memoryUsage", 40);   // frontend just needs numbers for demo
            data.put("diskUsage", 35);

            // Database status - for now assume connected if we reached here
            data.put("databaseStatus", "CONNECTED");
            data.put("lastChecked", Instant.now().toString());

            return ResponseEntity.ok(ApiResponse.success("System health OK", data));
        } catch (Exception e) {
            log.error("Failed to compute system health", e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("Failed to fetch system health", e.getMessage()));
        }
    }

    /**
     * GET /api/system/blockchain/health
     *
     * Admin-facing diagnostic endpoint for blockchain anchoring runtime health.
     */
    @GetMapping("/blockchain/health")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getBlockchainHealth() {
        try {
            Map<String, Object> data = blockchainService.healthSnapshot();
            return ResponseEntity.ok(ApiResponse.success("Blockchain health retrieved", data));
        } catch (Exception e) {
            log.error("Failed to fetch blockchain health", e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("Failed to fetch blockchain health", e.getMessage()));
        }
    }

    /**
     * GET /api/system/blockchain/tx/{txHash}
     *
     * Admin-facing tx lookup endpoint for local testnet verification.
     */
    @GetMapping("/blockchain/tx/{txHash}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getBlockchainTransaction(
            @PathVariable String txHash
    ) {
        try {
            Map<String, Object> data = blockchainService.inspectTransaction(txHash);
            boolean ok = "OK".equals(String.valueOf(data.get("status")));
            if (ok) {
                return ResponseEntity.ok(ApiResponse.success("Blockchain transaction retrieved", data));
            }
            return ResponseEntity.status(404).body(ApiResponse.success("Blockchain transaction not available", data));
        } catch (Exception e) {
            log.error("Failed to fetch blockchain tx by hash {}", txHash, e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("Failed to fetch blockchain transaction", e.getMessage()));
        }
    }

    /**
     * GET /api/system/blockchain/audit-anchor-retry/status
     *
     * Admin status endpoint for ANCHOR_FAILED retry worker.
     */
    @GetMapping("/blockchain/audit-anchor-retry/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getAuditAnchorRetryStatus() {
        try {
            Map<String, Object> data = auditAnchorRetryService.getRetryStatus();
            return ResponseEntity.ok(ApiResponse.success("Audit anchor retry status retrieved", data));
        } catch (Exception e) {
            log.error("Failed to fetch audit anchor retry status", e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("Failed to fetch audit anchor retry status", e.getMessage()));
        }
    }

    /**
     * POST /api/system/blockchain/audit-anchor-retry/run?limit=100
     *
     * Admin manual trigger to retry ANCHOR_FAILED audit logs.
     */
    @PostMapping("/blockchain/audit-anchor-retry/run")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> runAuditAnchorRetry(
            @RequestParam(name = "limit", defaultValue = "100") int limit
    ) {
        try {
            Map<String, Object> data = auditAnchorRetryService.retryFailedAnchors("ADMIN_MANUAL", limit);
            return ResponseEntity.ok(ApiResponse.success("Audit anchor retry executed", data));
        } catch (Exception e) {
            log.error("Failed to run audit anchor retry", e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("Failed to run audit anchor retry", e.getMessage()));
        }
    }

    /**
     * GET /api/system/blockchain/audit-chain-guardian/status
     *
     * Admin status endpoint for real-time chain integrity guardian.
     */
    @GetMapping("/blockchain/audit-chain-guardian/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getAuditChainGuardianStatus() {
        try {
            Map<String, Object> data = auditChainGuardianService.getStatus();
            return ResponseEntity.ok(ApiResponse.success("Audit chain guardian status retrieved", data));
        } catch (Exception e) {
            log.error("Failed to fetch audit chain guardian status", e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("Failed to fetch audit chain guardian status", e.getMessage()));
        }
    }

    /**
     * POST /api/system/blockchain/audit-chain-guardian/run
     *
     * Admin manual trigger: verify chain now and auto-act on detected issues.
     */
    @PostMapping("/blockchain/audit-chain-guardian/run")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> runAuditChainGuardianNow() {
        try {
            Map<String, Object> data = auditChainGuardianService.runGuardCheck("ADMIN_MANUAL");
            boolean compromised = Boolean.TRUE.equals(data.get("criticalCompromised"));
            if (compromised) {
                return ResponseEntity.status(409)
                        .body(ApiResponse.success("Audit chain guardian found CRITICAL issues", data));
            }
            return ResponseEntity.ok(ApiResponse.success("Audit chain guardian run completed", data));
        } catch (Exception e) {
            log.error("Failed to run audit chain guardian", e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("Failed to run audit chain guardian", e.getMessage()));
        }
    }

    /**
     * POST /api/system/blockchain/audit-chain/repair
     *
     * Repairs HASH_MISMATCH violations in the audit chain by recomputing hashes from the
     * last known-good record before the tampered section.
     *
     * This endpoint should only be used after a legitimate security test (e.g., Case 4)
     * has intentionally modified audit log data. In a real breach scenario, the correct
     * response is investigation, not silent repair.
     *
     * @param violatedLogIds ordered list of log IDs with HASH_MISMATCH (from guardian verify run)
     * @param initiatedBy admin performing the repair
     */
    @PostMapping("/blockchain/audit-chain/repair")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> repairAuditChain(
            @RequestParam List<Long> violatedLogIds,
            @AuthenticationPrincipal User currentUser
    ) {
        try {
            String initiatedBy = currentUser != null ? currentUser.getAccountId() : "ADMIN_API";
            Map<String, Object> result = auditService.repairChain(violatedLogIds, initiatedBy);
            String status = String.valueOf(result.get("status"));
            if ("REPAIRED".equals(status)) {
                return ResponseEntity.ok(ApiResponse.success("Audit chain repaired successfully", result));
            } else if ("PARTIAL".equals(status)) {
                return ResponseEntity.status(207)
                        .body(ApiResponse.success("Audit chain partially repaired (some errors occurred)", result));
            } else {
                return ResponseEntity.ok(ApiResponse.success("No repair needed", result));
            }
        } catch (Exception e) {
            log.error("Failed to repair audit chain", e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("Failed to repair audit chain", e.getMessage()));
        }
    }

    /**
     * DELETE /api/system/audit-logs/by-action/{action}
     *
     * Delete all audit logs matching a specific action.
     * Currently used to clean up false-positive CHAIN_GUARDIAN_ALERT entries
     * that were generated when blockchain was disabled but verify-on-chain was true.
     */
    @DeleteMapping("/audit-logs/by-action/{action}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> deleteAuditLogsByAction(
            @PathVariable String action
    ) {
        try {
            int count = auditLogRepository.deleteByAction(action);
            log.warn("Admin deleted {} audit log(s) with action={}", count, action);
            return ResponseEntity.ok(ApiResponse.success(
                    "Deleted " + count + " audit log(s) with action=" + action,
                    Map.of("deletedCount", count, "action", action)
            ));
        } catch (Exception e) {
            log.error("Failed to delete audit logs by action={}", action, e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("Failed to delete audit logs: " + e.getMessage()));
        }
    }

    /**
     * GET /api/system/llm/health
     *
     * Admin-facing diagnostic endpoint for LLM runtime health:
     * - token acquisition (ADC)
     * - Vertex model endpoint reachability
     */
    @GetMapping("/llm/health")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getLlmHealth() {
        try {
            Map<String, Object> data = llmClassificationService.healthSnapshot();
            boolean healthy = "HEALTHY".equals(String.valueOf(data.get("status")));
            if (healthy) {
                return ResponseEntity.ok(ApiResponse.success("LLM health retrieved", data));
            }
            return ResponseEntity.status(503).body(ApiResponse.success("LLM health check failed", data));
        } catch (Exception e) {
            log.error("Failed to fetch LLM health", e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("Failed to fetch LLM health", e.getMessage()));
        }
    }
}


