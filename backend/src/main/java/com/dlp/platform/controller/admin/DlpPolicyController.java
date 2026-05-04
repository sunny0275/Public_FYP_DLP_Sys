package com.dlp.platform.controller.admin;

import com.dlp.platform.dto.admin.DlpPolicyConfigurationDto;
import com.dlp.platform.dto.admin.DlpPolicyDto;
import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.entity.User;
import com.dlp.platform.service.admin.DlpPolicyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Controller for DLP Policy management
 * Phase 04-C: Admin Settings
 */
@Slf4j
@RestController
@RequestMapping("/admin/policies")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class DlpPolicyController {

    private final DlpPolicyService dlpPolicyService;

    /**
     * GET /api/admin/policies/dlp
     * Get current DLP policy configuration
     */
    @GetMapping("/dlp")
    public ResponseEntity<ApiResponse<DlpPolicyConfigurationDto>> getDlpPolicies() {
        try {
            DlpPolicyConfigurationDto configuration = dlpPolicyService.getDlpPolicyConfiguration();
            return ResponseEntity.ok(ApiResponse.success("DLP policies retrieved", configuration));
        } catch (Exception e) {
            log.error("Failed to retrieve DLP policies", e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("Failed to retrieve DLP policies: " + e.getMessage()));
        }
    }

    /**
     * GET /api/admin/policies/summary
     * Lightweight policy summary for dashboard cards.
     */
    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getDlpPolicySummary() {
        try {
            DlpPolicyConfigurationDto cfg = dlpPolicyService.getDlpPolicyConfiguration();
            Map<String, Object> summary = new java.util.LinkedHashMap<>();
            summary.put("classificationThreshold",
                cfg.getClassification() != null ? cfg.getClassification().getConfidenceThreshold() : null);
            summary.put("autoReviewEnabled",
                cfg.getClassification() != null && Boolean.TRUE.equals(cfg.getClassification().getAutoReviewEnabled()));
            summary.put("batchExportLimit",
                cfg.getSharing() != null ? cfg.getSharing().getBatchExportLimit() : null);
            summary.put("externalSharingRules",
                cfg.getSharing() != null && cfg.getSharing().getExternalSharingAllowed() != null
                    ? cfg.getSharing().getExternalSharingAllowed().size()
                    : 0);
            summary.put("watermarkRules",
                cfg.getSharing() != null && cfg.getSharing().getWatermarkEnforcement() != null
                    ? cfg.getSharing().getWatermarkEnforcement().size()
                    : 0);
            summary.put("edrTriggers",
                cfg.getEdr() != null && cfg.getEdr().getTriggerConditions() != null
                    ? cfg.getEdr().getTriggerConditions().size()
                    : 0);
            summary.put("anomalyRules",
                cfg.getAnomalyDetection() != null && cfg.getAnomalyDetection().getRiskScoringRules() != null
                    ? cfg.getAnomalyDetection().getRiskScoringRules().size()
                    : 0);
            return ResponseEntity.ok(ApiResponse.success("DLP policy summary retrieved", summary));
        } catch (Exception e) {
            log.error("Failed to retrieve DLP policy summary", e);
            return ResponseEntity.internalServerError()
                .body(ApiResponse.error("Failed to retrieve DLP policy summary: " + e.getMessage()));
        }
    }

    /**
     * PUT /api/admin/policies/dlp
     * Update DLP policy configuration
     */
    @PutMapping("/dlp")
    public ResponseEntity<ApiResponse<DlpPolicyConfigurationDto>> updateDlpPolicies(
            @Valid @RequestBody DlpPolicyConfigurationDto configuration,
            @RequestParam(required = false) String reason,
            @AuthenticationPrincipal User currentUser
    ) {
        try {
            String changedBy = currentUser != null ? currentUser.getAccountId() : "SYSTEM";
            String changeReason = reason != null ? reason : "Policy configuration updated";
            
            DlpPolicyConfigurationDto updated = dlpPolicyService.updateDlpPolicyConfiguration(
                    configuration, changedBy, changeReason
            );
            return ResponseEntity.ok(ApiResponse.success("DLP policies updated successfully", updated));
        } catch (Exception e) {
            log.error("Failed to update DLP policies", e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("Failed to update DLP policies: " + e.getMessage()));
        }
    }

    /**
     * GET /api/admin/policies/history?policyKey=...
     * Get policy change history
     */
    @GetMapping("/history")
    public ResponseEntity<ApiResponse<List<DlpPolicyDto>>> getPolicyHistory(
            @RequestParam(required = false) String policyKey
    ) {
        try {
            if (policyKey == null || policyKey.trim().isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("Policy key is required"));
            }
            List<DlpPolicyDto> history = dlpPolicyService.getPolicyHistory(policyKey);
            return ResponseEntity.ok(ApiResponse.success("Policy history retrieved", history));
        } catch (Exception e) {
            log.error("Failed to retrieve policy history", e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("Failed to retrieve policy history: " + e.getMessage()));
        }
    }

    /**
     * POST /api/admin/policies/rollback
     * Rollback to a specific policy version
     */
    @PostMapping("/rollback")
    public ResponseEntity<ApiResponse<DlpPolicyConfigurationDto>> rollbackPolicy(
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal User currentUser
    ) {
        try {
            String policyKey = (String) request.get("policyKey");
            Integer version = ((Number) request.get("version")).intValue();
            String reason = (String) request.getOrDefault("reason", "Policy rollback");
            
            if (policyKey == null || version == null) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("Policy key and version are required"));
            }
            
            String changedBy = currentUser != null ? currentUser.getAccountId() : "SYSTEM";
            DlpPolicyConfigurationDto updated = dlpPolicyService.rollbackPolicy(
                    policyKey, version, changedBy, reason
            );
            return ResponseEntity.ok(ApiResponse.success("Policy rolled back successfully", updated));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to rollback policy", e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("Failed to rollback policy: " + e.getMessage()));
        }
    }
}
