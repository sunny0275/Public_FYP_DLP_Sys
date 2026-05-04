package com.dlp.platform.controller.document;

import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.entity.User;
import com.dlp.platform.repository.DocumentRepository;
import com.dlp.platform.util.RoleUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Policy evaluation for batch operations (e.g. batch export).
 * POST /api/policy/evaluate - Evaluate whether current user can perform batch export on given documents.
 */
@Slf4j
@RestController
@RequestMapping("/policy")
@RequiredArgsConstructor
public class PolicyEvaluateController {

    private static final int BATCH_EXPORT_MAX_COUNT = 100;

    private final DocumentRepository documentRepository;

    @PostMapping("/evaluate")
    public ResponseEntity<ApiResponse<Map<String, Object>>> evaluateBatchExport(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User currentUser) {

        @SuppressWarnings("unchecked")
        List<Number> documentIds = body != null && body.containsKey("documentIds")
                ? (List<Number>) body.get("documentIds")
                : List.of();

        if (documentIds == null || documentIds.isEmpty()) {
            return ResponseEntity.ok(ApiResponse.success("Evaluation complete",
                    Map.of("allowed", false, "message", "No documents selected")));
        }

        if (documentIds.size() > BATCH_EXPORT_MAX_COUNT) {
            return ResponseEntity.ok(ApiResponse.success("Evaluation complete",
                    Map.of("allowed", false, "message", "Batch export limit is " + BATCH_EXPORT_MAX_COUNT + " documents")));
        }

        List<Long> ids = documentIds.stream().map(Number::longValue).toList();
        var documents = documentRepository.findAllById(ids);

        if (documents.size() != ids.size()) {
            return ResponseEntity.ok(ApiResponse.success("Evaluation complete",
                    Map.of("allowed", false, "message", "One or more documents not found")));
        }

        for (var doc : documents) {
            if (doc.getOwner() == null || !doc.getOwner().getId().equals(currentUser.getId())
                    && !RoleUtils.isAdmin(currentUser.getRoles())) {
                return ResponseEntity.ok(ApiResponse.success("Evaluation complete",
                        Map.of("allowed", false, "message", "You do not have permission to export all selected documents")));
            }
        }

        return ResponseEntity.ok(ApiResponse.success("Evaluation complete",
                Map.of("allowed", true, "message", "Batch export permitted")));
    }
}
