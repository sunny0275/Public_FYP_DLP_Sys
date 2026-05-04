package com.dlp.platform.controller.ueba;

import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.dto.ueba.UebaRuleDto;
import com.dlp.platform.entity.User;
import com.dlp.platform.repository.UserRepository;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import com.dlp.platform.service.ueba.LlmAnalysisResult;
import com.dlp.platform.service.ueba.LlmUebaAnalysisService;
import com.dlp.platform.service.ueba.UebaRiskService;
import com.dlp.platform.service.ueba.UebaRuleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Slf4j
@RestController
@RequestMapping("/ueba")
@RequiredArgsConstructor
public class UebaController {

    private final UebaRiskService uebaRiskService;
    private final UebaRuleService uebaRuleService;
    private final LlmUebaAnalysisService llmUebaAnalysisService;
    private final UserRepository userRepository;

    /**
     * Top N users by highest risk (lowest UEBA score). For dashboards/charts.
     */
    @GetMapping("/top-risk")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getTopRiskUsers(
            @RequestParam(defaultValue = "10") int limit
    ) {
        int size = Math.min(Math.max(1, limit), 100);
        Pageable pageable = PageRequest.of(0, size, Sort.by(Sort.Direction.ASC, "uebaScore"));
        Page<User> page = userRepository.searchUebaUsers(null, "", false, false, pageable);
        List<Map<String, Object>> list = new ArrayList<>();
        for (User u : page.getContent()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("userId", u.getId());
            m.put("accountId", u.getAccountId());
            m.put("fullName", u.getFullName());
            m.put("department", u.getDepartment());
            m.put("roles", u.getRoles());
            m.put("uebaScore", u.getUebaScore() != null ? u.getUebaScore() : 100);
            m.put("accountEnabled", u.getAccountEnabled());
            list.add(m);
        }
        return ResponseEntity.ok(ApiResponse.success("Top risk users retrieved", list));
    }

    @GetMapping("/risk-score")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getRiskScore(
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String sessionId,
            @RequestParam(required = false) Long documentId
    ) {
        Map<String, Object> score = uebaRiskService.getRiskScore(userId, sessionId, documentId);
        return ResponseEntity.ok(ApiResponse.success("Risk score retrieved", score));
    }

    @PostMapping("/risk-evaluation")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> evaluateRisk(@RequestBody Map<String, Object> body) {
        Long userId = body.get("userId") != null ? ((Number) body.get("userId")).longValue() : null;
        String sessionId = (String) body.get("sessionId");
        Long documentId = body.get("documentId") != null ? ((Number) body.get("documentId")).longValue() : null;
        Map<String, Object> score = uebaRiskService.getRiskScore(userId, sessionId, documentId);
        return ResponseEntity.ok(ApiResponse.success("Risk evaluation completed", score));
    }

    @GetMapping("/incidents")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Page<Map<String, Object>>>> getIncidents(
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "timestamp"));
        Page<Map<String, Object>> incidents = uebaRiskService.getIncidents(severity, status, pageable);
        return ResponseEntity.ok(ApiResponse.success("UEBA incidents retrieved", incidents));
    }

    @GetMapping("/baseline")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getBaseline(@RequestParam Long userId) {
        Map<String, Object> baseline = uebaRiskService.getBaseline(userId);
        return ResponseEntity.ok(ApiResponse.success("Baseline retrieved", baseline));
    }

    @GetMapping("/users-scores")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Page<Map<String, Object>>>> getUserScores(
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "false") boolean includeAll,
            @RequestParam(defaultValue = "score") String sortBy,
            @RequestParam(defaultValue = "asc") String sortOrder,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        try {
            String normalizedSort = (sortBy == null ? "" : sortBy.trim());
            String sortField = ("createdAt".equalsIgnoreCase(normalizedSort) || "created_at".equalsIgnoreCase(normalizedSort))
                    ? "createdAt"
                    : "uebaScore";
            Sort.Direction direction = "desc".equalsIgnoreCase(sortOrder) ? Sort.Direction.DESC : Sort.Direction.ASC;
            Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortField));

            String normalizedQuery = (query == null || query.isBlank()) ? null : query.trim().toLowerCase();
            boolean hasQuery = normalizedQuery != null;
            String queryForLike = hasQuery ? normalizedQuery : "";
            String normalizedDept = (department == null || department.isBlank()) ? null : department.trim();

            Page<Map<String, Object>> result = userRepository.searchUebaUsers(
                    normalizedDept,
                    queryForLike,
                    hasQuery,
                    includeAll,
                    pageable
            ).map(u -> {
                Map<String, Object> m = new java.util.LinkedHashMap<>();
                m.put("userId", u.getId());
                m.put("accountId", u.getAccountId());
                m.put("fullName", u.getFullName());
                m.put("department", u.getDepartment());
                m.put("roles", u.getRoles());
                m.put("uebaScore", u.getUebaScore() != null ? u.getUebaScore() : 100);
                m.put("createdAt", u.getCreatedAt());
                m.put("updatedAt", u.getUpdatedAt());
                m.put("accountEnabled", u.getAccountEnabled());
                return m;
            });

            return ResponseEntity.ok(ApiResponse.success("UEBA user scores retrieved", result));
        } catch (Exception e) {
            log.error("Failed to retrieve UEBA user scores", e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("Failed to retrieve UEBA user scores: " + e.getMessage()));
        }
    }

    @GetMapping("/features")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getFeatures(
            @RequestParam Long userId,
            @RequestParam(required = false) String timeRange) {
        List<Map<String, Object>> features = uebaRiskService.getFeatures(userId, timeRange);
        return ResponseEntity.ok(ApiResponse.success("Behavioral features retrieved", features));
    }

    @PostMapping("/incidents/{id}/investigate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> investigateIncident(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, Object> body,
            @AuthenticationPrincipal User currentUser) {
        Map<String, Object> result = uebaRiskService.investigateIncident(id, body != null ? body : Map.of());
        return ResponseEntity.ok(ApiResponse.success("Incident investigation updated", result));
    }

    @GetMapping("/rules")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Page<UebaRuleDto>>> listRules(
            @RequestParam(required = false) String ruleType,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("ruleType", "priority"));
        Page<UebaRuleDto> rules = uebaRuleService.listRules(ruleType, pageable);
        return ResponseEntity.ok(ApiResponse.success("Rules retrieved", rules));
    }

    @GetMapping("/rules/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<UebaRuleDto>> getRule(@PathVariable Long id) {
        return uebaRuleService.getRule(id)
                .map(dto -> ResponseEntity.ok(ApiResponse.success("Rule retrieved", dto)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/rules")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<UebaRuleDto>> createRule(
            @RequestBody UebaRuleDto dto,
            @AuthenticationPrincipal User currentUser
    ) {
        String changedBy = currentUser != null ? currentUser.getAccountId() : "system";
        UebaRuleDto created = uebaRuleService.createRule(dto, changedBy, "Created via API");
        return ResponseEntity.ok(ApiResponse.success("Rule created", created));
    }

    @PutMapping("/rules/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<UebaRuleDto>> updateRule(
            @PathVariable Long id,
            @RequestBody UebaRuleDto dto,
            @AuthenticationPrincipal User currentUser
    ) {
        String changedBy = currentUser != null ? currentUser.getAccountId() : "system";
        try {
            UebaRuleDto updated = uebaRuleService.updateRule(id, dto, changedBy, "Updated via API");
            return ResponseEntity.ok(ApiResponse.success("Rule updated", updated));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/rules/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteRule(@PathVariable Long id) {
        try {
            uebaRuleService.deleteRule(id);
            return ResponseEntity.ok(ApiResponse.success("Rule deleted", null));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PatchMapping("/rules/{id}/enabled")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<UebaRuleDto>> setRuleEnabled(
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> body,
            @AuthenticationPrincipal User currentUser
    ) {
        Boolean enabled = body != null && body.containsKey("enabled") ? body.get("enabled") : null;
        if (enabled == null) return ResponseEntity.badRequest().build();
        String changedBy = currentUser != null ? currentUser.getAccountId() : "system";
        try {
            UebaRuleDto dto = uebaRuleService.setEnabled(id, enabled, changedBy);
            return ResponseEntity.ok(ApiResponse.success("Rule enabled updated", dto));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/policies/risk-adaptive")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getRiskAdaptivePolicy() {
        Map<String, Object> policy = uebaRuleService.getRiskAdaptivePolicy();
        return ResponseEntity.ok(ApiResponse.success("Risk-adaptive policy retrieved", policy));
    }

    @PutMapping("/policies/risk-adaptive")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> setRiskAdaptivePolicy(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User currentUser
    ) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> thresholds = (List<Map<String, Object>>) body.get("thresholds");
        if (thresholds == null) return ResponseEntity.badRequest().build();
        String changedBy = currentUser != null ? currentUser.getAccountId() : "system";
        Map<String, Object> policy = uebaRuleService.setRiskAdaptivePolicy(thresholds, changedBy);
        return ResponseEntity.ok(ApiResponse.success("Risk-adaptive policy updated", policy));
    }

    // ========== LLM-based UEBA endpoints ==========

    /**
     * Health check for LLM UEBA service.
     * Returns status of Vertex AI integration and configuration.
     */
    @GetMapping("/llm/health")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getLlmUebaHealth() {
        Map<String, Object> health = llmUebaAnalysisService.healthCheck();
        return ResponseEntity.ok(ApiResponse.success("LLM UEBA health status", health));
    }

    /**
     * Test LLM UEBA analysis with a sample event.
     * Useful for verifying LLM configuration and understanding detection behavior.
     */
    @PostMapping("/llm/test")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> testLlmUebaAnalysis(
            @RequestBody Map<String, Object> testEvent
    ) {
        try {
            Long userId = testEvent.get("userId") != null ? ((Number) testEvent.get("userId")).longValue() : null;
            String accountId = (String) testEvent.get("accountId");
            String action = (String) testEvent.get("action");
            String category = testEvent.get("category") != null ? testEvent.get("category").toString() : "AUTH";
            String result = testEvent.get("result") != null ? testEvent.get("result").toString() : "WARNING";
            String details = (String) testEvent.get("details");
            String ipAddress = (String) testEvent.get("ipAddress");

            LocalDateTime timestamp = LocalDateTime.now();
            if (testEvent.get("timestamp") != null) {
                try {
                    timestamp = LocalDateTime.parse(testEvent.get("timestamp").toString());
                } catch (Exception ignored) {}
            }

            LlmAnalysisResult llmResult = llmUebaAnalysisService.analyzeEventSync(
                    userId, accountId, action, category, result, details, ipAddress, timestamp
            );

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("inputEvent", testEvent);
            response.put("analysisResult", Map.of(
                    "isAnomalous", llmResult.isAnomalous(),
                    "confidence", llmResult.getConfidence(),
                    "anomalyType", llmResult.getAnomalyType(),
                    "reason", llmResult.getReason(),
                    "recommendedAction", llmResult.getRecommendedAction(),
                    "severity", llmResult.getSeverity(),
                    "fallbackRuleBased", llmResult.isFallbackRuleBased()
            ));

            return ResponseEntity.ok(ApiResponse.success("LLM UEBA test analysis completed", response));

        } catch (Exception e) {
            log.error("LLM UEBA test failed: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("LLM UEBA test failed: " + e.getMessage()));
        }
    }

    /**
     * Get LLM UEBA configuration and tuning status.
     */
    @GetMapping("/llm/config")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getLlmUebaConfig() {
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("enabled", true);
        config.put("model", "gemini-2.5-flash (configurable via LLM_UEBA_MODEL)");
        config.put("location", "us-central1 (configurable via LLM_UEBA_VERTEX_LOCATION)");
        config.put("confidenceThreshold", 0.7);
        config.put("fallbackEnabled", true);
        config.put("description", "LLM-based UEBA reduces false positives by using AI to understand event context");
        config.put("vertexConfig", Map.of(
            "project", "via LLM_UEBA_VERTEX_PROJECT or GOOGLE_CLOUD_PROJECT",
            "location", "via LLM_UEBA_VERTEX_LOCATION or GOOGLE_CLOUD_LOCATION",
            "model", "gemini-2.5-flash (separate from document classification)",
            "endpointId", "via LLM_UEBA_ENDPOINT_ID — set AFTER UEBA tuning completes; DO NOT use VERTEX_ENDPOINT_ID (that's for document classification)"
        ));
        config.put("tuning", Map.of(
            "enabled", true,
            "minExamples", 100,
            "currentExampleCount", 0,
            "readyToTune", false,
            "gcsBucket", "via LLM_UEBA_TUNING_GCS_BUCKET or VERTEX_TUNING_GCS_BUCKET",
            "autoTriggerCron", "daily at 4am (llm-ueba.tuning.auto-trigger-cron)",
            "description", "Automatically tunes gemini-2.5-flash on UEBA events; after tuning completes, set LLM_UEBA_ENDPOINT_ID env var to the deployed endpoint ID"
        ));
        config.put("supportedActions", List.of(
                "Analyzes all WARNING/FAILURE audit events",
                "Recognizes benign actions (screen switches, alt-tab) as normal",
                "Detects true anomalies (credential attacks, off-hours access, data exfiltration)",
                "Applies adaptive scoring based on LLM confidence"
        ));
        return ResponseEntity.ok(ApiResponse.success("LLM UEBA configuration", config));
    }
}
