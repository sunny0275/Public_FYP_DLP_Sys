package com.dlp.platform.controller.edr;

import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.entity.EdrPolicy;
import com.dlp.platform.entity.User;
import com.dlp.platform.service.audit.AuditService;
import com.dlp.platform.service.edr.EdrPolicyService;
import com.dlp.platform.service.dashboard.SecurityAnalyticsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * EDR / Incident dashboard and policy endpoints.
 * Phase 04-D: EDR Console.
 */
@Slf4j
@RestController
@RequestMapping
@RequiredArgsConstructor
public class EdrController {

    private final SecurityAnalyticsService securityAnalyticsService;
    private final AuditService auditService;
    private final EdrPolicyService edrPolicyService;

    /**
     * GET /api/edr/incidents
     * Security analyst dashboard – EDR incident list.
     */
    @GetMapping("/edr/incidents")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getIncidents() {
        log.debug("EDR incidents requested");
        List<Map<String, Object>> incidents = securityAnalyticsService.getRecentIncidents();
        return ResponseEntity.ok(
                ApiResponse.success("EDR incidents fetched successfully", incidents)
        );
    }

    /**
     * GET /api/edr/events
     * EDR events list (same source as incidents; supports optional filtering).
     */
    @GetMapping("/edr/events")
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getEvents(
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) String action
    ) {
        List<Map<String, Object>> events = securityAnalyticsService.getRecentIncidents();
        if (severity != null && !severity.isBlank()) {
            String sev = severity.toUpperCase();
            events = events.stream()
                    .filter(m -> sev.equals(m.get("severity")))
                    .collect(Collectors.toList());
        }
        if (action != null && !action.isBlank()) {
            String act = action.toUpperCase();
            events = events.stream()
                    .filter(m -> act.equals(String.valueOf(m.get("action")).toUpperCase()))
                    .collect(Collectors.toList());
        }
        return ResponseEntity.ok(ApiResponse.success("EDR events fetched", events));
    }

    /**
     * POST /api/edr/actions/block
     * Block user/host – recorded to audit; enforcement can be wired to agent later.
     */
    @PostMapping("/edr/actions/block")
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER')")
    public ResponseEntity<ApiResponse<Map<String, String>>> block(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User currentUser
    ) {
        String hostId = (String) body.get("hostId");
        Long userId = body.get("userId") != null ? ((Number) body.get("userId")).longValue() : null;
        String reason = (String) body.getOrDefault("reason", "Blocked from EDR console");
        String accountId = currentUser != null ? currentUser.getAccountId() : "SYSTEM";
        auditService.logEvent(
                currentUser != null ? currentUser.getId() : null,
                accountId,
                "EDR_BLOCK",
                "EDR",
                "SUCCESS",
                String.format("Block action: hostId=%s, userId=%s, reason=%s", hostId, userId, reason),
                null, null, null
        );
        log.info("EDR block recorded: hostId={}, userId={}, by={}", hostId, userId, accountId);
        return ResponseEntity.ok(ApiResponse.success("Block action recorded", Map.of("status", "recorded")));
    }

    /**
     * POST /api/edr/actions/isolate
     * Isolate host – recorded to audit; enforcement can be wired to agent later.
     */
    @PostMapping("/edr/actions/isolate")
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER')")
    public ResponseEntity<ApiResponse<Map<String, String>>> isolate(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User currentUser
    ) {
        String hostId = (String) body.get("hostId");
        String reason = (String) body.getOrDefault("reason", "Isolated from EDR console");
        String accountId = currentUser != null ? currentUser.getAccountId() : "SYSTEM";
        auditService.logEvent(
                currentUser != null ? currentUser.getId() : null,
                accountId,
                "EDR_ISOLATE",
                "EDR",
                "SUCCESS",
                String.format("Isolate action: hostId=%s, reason=%s", hostId, reason),
                null, null, null
        );
        log.info("EDR isolate recorded: hostId={}, by={}", hostId, accountId);
        return ResponseEntity.ok(ApiResponse.success("Isolate action recorded", Map.of("status", "recorded")));
    }

    /**
     * GET /api/edr/policies
     */
    @GetMapping("/edr/policies")
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER')")
    public ResponseEntity<ApiResponse<List<EdrPolicy>>> getPolicies() {
        List<EdrPolicy> policies = edrPolicyService.listPolicies();
        return ResponseEntity.ok(ApiResponse.success("EDR policies fetched", policies));
    }

    /**
     * POST /api/edr/policies
     * Create or update EDR policy (send id in body to update).
     */
    @PostMapping("/edr/policies")
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER')")
    public ResponseEntity<ApiResponse<EdrPolicy>> savePolicy(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User currentUser
    ) {
        Long id = body.get("id") != null ? ((Number) body.get("id")).longValue() : null;
        String name = (String) body.get("name");
        String description = (String) body.get("description");
        String rulesJson = body.get("rulesJson") != null ? body.get("rulesJson").toString() : "[]";
        String status = (String) body.get("status");
        if (name == null || name.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Policy name is required"));
        }
        EdrPolicy policy = edrPolicyService.createOrUpdatePolicy(id, name, description, rulesJson, status, currentUser);
        return ResponseEntity.ok(ApiResponse.success("EDR policy saved", policy));
    }

    /**
     * DELETE /api/edr/policies/{id}
     */
    @DeleteMapping("/edr/policies/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER')")
    public ResponseEntity<ApiResponse<Void>> deletePolicy(@PathVariable Long id, @AuthenticationPrincipal User currentUser) {
        edrPolicyService.deletePolicy(id, currentUser);
        return ResponseEntity.ok(ApiResponse.success("EDR policy deleted", null));
    }

    /**
     * POST /api/edr/policies/{id}/distribute
     * Mark policy as distributed and emit audit trail.
     */
    @PostMapping("/edr/policies/{id}/distribute")
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> distributePolicy(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser
    ) {
        try {
            Map<String, Object> result = edrPolicyService.distributePolicy(id, currentUser);
            return ResponseEntity.ok(ApiResponse.success("EDR policy distributed", result));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to distribute EDR policy {}", id, e);
            return ResponseEntity.internalServerError()
                .body(ApiResponse.error("Failed to distribute EDR policy", e.getMessage()));
        }
    }

    /**
     * GET /api/investigations
     * Ongoing / historical incident investigations.
     */
    @GetMapping("/investigations")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getInvestigations() {
        log.debug("Investigations requested");
        List<Map<String, Object>> investigations = securityAnalyticsService.getInvestigations();
        return ResponseEntity.ok(
                ApiResponse.success("Investigations fetched successfully", investigations)
        );
    }
}



