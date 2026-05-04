package com.dlp.platform.controller.dashboard;

import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.entity.SignatureRecord;
import com.dlp.platform.service.dashboard.SecurityAnalyticsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Minimal endpoints required by the compliance dashboard to avoid 500s.
 */
@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ComplianceController {

    private final SecurityAnalyticsService securityAnalyticsService;
    private final com.dlp.platform.repository.SignatureRepository signatureRepository;

    @GetMapping("/classification/drift")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getClassificationDrift() {
        List<Map<String, Object>> incidents = securityAnalyticsService.getRecentIncidents();
        List<Map<String, Object>> drift = incidents.stream()
            .filter(m -> {
                String action = String.valueOf(m.get("action")).toUpperCase();
                String details = String.valueOf(m.get("details")).toUpperCase();
                return action.contains("CLASSIFICATION")
                    || action.contains("RESOLVE")
                    || details.contains("DIFFERS FROM LLM")
                    || details.contains("MANUAL REVIEW");
            })
            .limit(50)
            .collect(Collectors.toList());
        return ResponseEntity.ok(
                ApiResponse.success("Classification drift data retrieved", drift)
        );
    }

    @GetMapping("/signatures/expiring")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getSignatureExpirations() {
        List<Map<String, Object>> pending = signatureRepository
            .findByStatusOrderBySignedAtAsc(SignatureRecord.SignatureStatus.PENDING)
            .stream()
            .limit(100)
            .map(s -> {
                Map<String, Object> item = new java.util.LinkedHashMap<>();
                item.put("signatureId", s.getId());
                item.put("documentId", s.getDocumentId());
                item.put("userId", s.getUserId());
                item.put("status", s.getStatus().name());
                item.put("signedAt", s.getSignedAt() != null ? s.getSignedAt().toString() : null);
                return item;
            })
            .collect(Collectors.toList());
        return ResponseEntity.ok(
                ApiResponse.success("Signature verification queue retrieved", pending)
        );
    }

    @GetMapping("/policies/violations")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getPolicyViolations() {
        List<Map<String, Object>> incidents = securityAnalyticsService.getRecentIncidents();
        List<Map<String, Object>> violations = incidents.stream()
            .filter(m -> {
                String action = String.valueOf(m.get("action")).toUpperCase();
                String details = String.valueOf(m.get("details")).toUpperCase();
                return action.contains("POLICY")
                    || action.contains("DENIED")
                    || details.contains("POLICY")
                    || details.contains("BLOCK");
            })
            .limit(100)
            .collect(Collectors.toList());
        return ResponseEntity.ok(
                ApiResponse.success("Policy violation events retrieved", violations)
        );
    }
}

