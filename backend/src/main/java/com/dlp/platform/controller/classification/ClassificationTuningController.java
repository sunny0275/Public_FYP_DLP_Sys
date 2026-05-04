package com.dlp.platform.controller.classification;

import com.dlp.platform.dto.classification.CustomTuningSampleRequest;
import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.service.classification.ClassificationTuningAutoService;
import com.dlp.platform.service.classification.ClassificationTuningService;
import com.dlp.platform.service.classification.VertexTuningSeedService;
import com.dlp.platform.service.classification.VertexTuningUploadService;
import com.dlp.platform.service.vertex.VertexEndpointResolver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Admin API for classification tuning dataset (Vertex AI supervised fine-tuning).
 * When the LLM suggested level is wrong and the reviewer/user confirms the correct level,
 * the example is recorded automatically. This controller exposes export for tuning.
 */
@Slf4j
@RestController
@RequestMapping("/admin/classification-tuning")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER')")
public class ClassificationTuningController {

    private final ClassificationTuningService classificationTuningService;
    private final VertexTuningUploadService vertexTuningUploadService;
    private final VertexTuningSeedService vertexTuningSeedService;
    private final ClassificationTuningAutoService classificationTuningAutoService;

    @Autowired(required = false)
    private VertexEndpointResolver vertexEndpointResolver;

    /**
     * GET /api/admin/classification-tuning/stats
     * Returns count of stored correction examples (for tuning dataset).
     */
    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getStats() {
        long count = classificationTuningService.countExamples();
        return ResponseEntity.ok(ApiResponse.success("Tuning examples count",
                Map.of("count", count, "message",
                        "Examples are recorded when suggested level is wrong and reviewer/user confirms correct level.")));
    }

    /**
     * GET /api/admin/classification-tuning/endpoints
     * Returns the current status of dynamically resolved endpoints from the tuning service.
     */
    @GetMapping("/endpoints")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getEndpointStatus() {
        Map<String, Object> status = new LinkedHashMap<>();

        if (vertexEndpointResolver == null) {
            status.put("dynamicResolverEnabled", false);
            status.put("message", "VertexEndpointResolver not available");
            return ResponseEntity.ok(ApiResponse.success("Endpoint resolver status", status));
        }

        status.put("dynamicResolverEnabled", true);
        status.put("cachedEndpoints", vertexEndpointResolver.getCachedEndpoints());
        status.put("classificationEndpointId", vertexEndpointResolver.getClassificationEndpointId());
        status.put("uebaEndpointId", vertexEndpointResolver.getUebaEndpointId());
        status.put("lastUpdateTime", vertexEndpointResolver.getLastUpdateTime());

        return ResponseEntity.ok(ApiResponse.success("Endpoint resolver status", status));
    }

    /**
     * POST /api/admin/classification-tuning/endpoints/refresh
     * Force refresh the endpoint cache from the tuning service.
     */
    @PostMapping("/endpoints/refresh")
    public ResponseEntity<ApiResponse<Map<String, Object>>> refreshEndpoints() {
        Map<String, Object> result = new LinkedHashMap<>();

        if (vertexEndpointResolver == null) {
            result.put("success", false);
            result.put("message", "VertexEndpointResolver not available");
            return ResponseEntity.ok(ApiResponse.success("Endpoint refresh failed", result));
        }

        Map<String, String> before = vertexEndpointResolver.getCachedEndpoints();
        vertexEndpointResolver.refreshEndpointCache();
        Map<String, String> after = vertexEndpointResolver.getCachedEndpoints();

        result.put("success", true);
        result.put("before", before);
        result.put("after", after);
        result.put("message", "Endpoint cache refreshed");

        return ResponseEntity.ok(ApiResponse.success("Endpoint refresh completed", result));
    }

    /**
     * GET /api/admin/classification-tuning/export
     * Exports all stored examples as Vertex AI JSONL (one line per example).
     * Use ?download=true to get as file attachment. Otherwise returns JSON { "data": "line1\nline2\n..." }.
     * Upload the JSONL file to a GCS bucket and create a Vertex AI supervised tuning job (e.g. Gemini 2.5).
     */
    @GetMapping("/export")
    public ResponseEntity<?> exportJsonl(
            @RequestParam(value = "download", defaultValue = "false") boolean download
    ) {
        String jsonl = classificationTuningService.exportToJsonl();
        if (download) {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            headers.setContentDispositionFormData("attachment", "classification-tuning-dataset.jsonl");
            return ResponseEntity.ok()
                    .headers(headers)
                    .body(jsonl);
        }
        return ResponseEntity.ok(ApiResponse.success("Export for Vertex AI supervised tuning", jsonl));
    }

    /**
     * POST /api/admin/classification-tuning/upload-to-gcs
     * Exports the tuning dataset to JSONL and uploads it to the configured GCS bucket.
     * Requires vertex.tuning.gcs-bucket (or VERTEX_TUNING_GCS_BUCKET) to be set.
     * Uses application default credentials (GOOGLE_APPLICATION_CREDENTIALS or gcloud ADC).
     * Returns gcsUri (gs://bucket/...) for use when creating a Vertex AI supervised tuning job.
     */
    @PostMapping("/upload-to-gcs")
    public ResponseEntity<ApiResponse<Map<String, Object>>> uploadExportToGcs() {
        Map<String, Object> result = vertexTuningUploadService.exportAndUploadToGcs();
        return ResponseEntity.ok(ApiResponse.success("Vertex tuning dataset upload", result));
    }

    /**
     * POST /api/admin/classification-tuning/seed-and-upload-to-gcs
     * Builds a Vertex AI tuning JSONL from bundled sample documents (10 samples: public, internal, confidential, strictly confidential),
     * uploads it to the configured GCS bucket, and returns the gcsUri for use in a Vertex AI supervised tuning job.
     * Requires vertex.tuning.gcs-bucket (or VERTEX_TUNING_GCS_BUCKET) to be set.
     */
    @PostMapping("/seed-and-upload-to-gcs")
    public ResponseEntity<ApiResponse<Map<String, Object>>> seedAndUploadToGcs() {
        Map<String, Object> result = vertexTuningSeedService.buildSeedJsonlAndUploadToGcs();
        return ResponseEntity.ok(ApiResponse.success("Seed samples uploaded to GCS for Vertex AI training", result));
    }

    /**
     * POST /api/admin/classification-tuning/upload-custom-samples-to-gcs
     * Builds Vertex AI tuning JSONL from custom samples (content + expectedLevel per item),
     * uploads to the configured GCS bucket, and returns gcsUri.
     * Use this to upload e.g. docs/llm-test-samples/*.md with labels (see upload-llm-test-samples-to-vertex.ps1).
     */
    @PostMapping("/upload-custom-samples-to-gcs")
    public ResponseEntity<ApiResponse<Map<String, Object>>> uploadCustomSamplesToGcs(
            @RequestBody CustomTuningSampleRequest request) {
        Map<String, Object> result = vertexTuningSeedService.buildJsonlFromCustomSamplesAndUploadToGcs(
                request != null ? request.getSamples() : null);
        return ResponseEntity.ok(ApiResponse.success("Custom samples uploaded to GCS for Vertex AI training", result));
    }

    /**
     * POST /api/admin/classification-tuning/auto-trigger
     * Checks if there are enough tuning examples; if yes, exports + uploads JSONL to GCS
     * and calls the external Python tuning service (Cloud Run, etc.) to start a supervised tuning job.
     */
    @PostMapping("/auto-trigger")
    public ResponseEntity<ApiResponse<Map<String, Object>>> autoTriggerTuning() {
        Map<String, Object> result = classificationTuningAutoService.autoTriggerIfReady();
        return ResponseEntity.ok(ApiResponse.success("Auto tuning trigger result", result));
    }

    /**
     * GET /api/admin/classification-tuning/status
     * Returns:
     * - current tuning example count
     * - configured min-examples threshold
     * - auto-tuning enabled flag
     * - last auto-trigger result (if any)
     */
    @GetMapping("/status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getTuningStatus() {
        long count = classificationTuningService.countExamples();
        Map<String, Object> last = classificationTuningAutoService.getLastAutoTriggerResult();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("exampleCount", count);
        payload.put("minExamples", classificationTuningAutoService.getMinExamplesForAutoTuning());
        payload.put("autoTuningEnabled", classificationTuningAutoService.isAutoTuningEnabled());
        payload.put("currentVersion", classificationTuningAutoService.getCurrentVersionLabel());
        payload.put("nextVersion", classificationTuningAutoService.getNextVersionLabel());
        payload.put("gcsConfigured", vertexTuningUploadService.isGcsConfigured());
        payload.put("continualTraining", classificationTuningAutoService.isContinualTraining());
        payload.put("baseModel", classificationTuningAutoService.getTuningBaseModel());
        // last can be null before the first trigger attempt; LinkedHashMap accepts null values.
        payload.put("lastAutoTrigger", last);

        return ResponseEntity.ok(ApiResponse.success("Classification tuning status", payload));
    }

    /**
     * GET /api/admin/classification-tuning/version
     * Returns version info and naming convention.
     */
    @GetMapping("/version")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getVersion() {
        Map<String, Object> info = Map.of(
                "currentVersion", classificationTuningAutoService.getCurrentVersionLabel(),
                "nextVersion", classificationTuningAutoService.getNextVersionLabel(),
                "namingConvention", "LLM_Classification_{version} — e.g. LLM_Classification_v0, LLM_Classification_v1, ...",
                "continualTraining", classificationTuningAutoService.isContinualTraining()
        );
        return ResponseEntity.ok(ApiResponse.success("Classification tuning version info", info));
    }

    /**
     * GET /api/admin/classification-tuning/auto-toggle
     * Returns the current auto-tuning enabled state.
     */
    @GetMapping("/auto-toggle")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getAutoToggle() {
        Map<String, Object> payload = Map.of("enabled", classificationTuningAutoService.isAutoTuningEnabled());
        return ResponseEntity.ok(ApiResponse.success("Classification auto-tuning toggle state", payload));
    }

    /**
     * POST /api/admin/classification-tuning/auto-toggle?enabled=true|false
     * Enables or disables the classification auto-tuning pipeline.
     */
    @PostMapping("/auto-toggle")
    public ResponseEntity<ApiResponse<Map<String, Object>>> setAutoToggle(
            @RequestParam(value = "enabled", defaultValue = "true") boolean enabled
    ) {
        classificationTuningAutoService.setAutoTuningEnabled(enabled);
        Map<String, Object> payload = Map.of(
                "enabled", classificationTuningAutoService.isAutoTuningEnabled(),
                "message", enabled ? "Classification auto-tuning ENABLED" : "Classification auto-tuning DISABLED"
        );
        return ResponseEntity.ok(ApiResponse.success(
                enabled ? "Auto-tuning enabled" : "Auto-tuning disabled", payload));
    }

    /**
     * PUT /api/admin/classification-tuning/min-examples
     * Sets the minimum number of examples required to trigger auto-tuning (minimum 100).
     */
    @PutMapping("/min-examples")
    public ResponseEntity<ApiResponse<Map<String, Object>>> setMinExamples(
            @RequestParam(value = "value", defaultValue = "100") long value
    ) {
        if (value < 100) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("minExamples must be at least 100"));
        }
        classificationTuningAutoService.setMinExamplesForAutoTuning(value);
        Map<String, Object> payload = Map.of(
                "minExamples", classificationTuningAutoService.getMinExamplesForAutoTuning(),
                "message", "Minimum examples threshold updated to " + value
        );
        return ResponseEntity.ok(ApiResponse.success("min-examples threshold updated", payload));
    }

    /**
     * GET /api/admin/classification-tuning/endpoint-lock
     * Returns the current endpoint lock status (locked endpoints, cache, etc.)
     */
    @GetMapping("/endpoint-lock")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getEndpointLockStatus() {
        Map<String, Object> status = classificationTuningAutoService.getEndpointLockStatus();
        return ResponseEntity.ok(ApiResponse.success("Endpoint lock status", status));
    }

    /**
     * POST /api/admin/classification-tuning/endpoint-lock/lock
     * Manually lock the current endpoint versions.
     * Use this before starting manual tuning to ensure stability.
     */
    @PostMapping("/endpoint-lock/lock")
    public ResponseEntity<ApiResponse<Map<String, Object>>> lockEndpoints() {
        Map<String, Object> result = classificationTuningAutoService.lockEndpoints();
        String message = (Boolean.TRUE.equals(result.get("success")))
                ? "Endpoints locked successfully"
                : "Failed to lock endpoints";
        return ResponseEntity.ok(ApiResponse.success(message, result));
    }

    /**
     * POST /api/admin/classification-tuning/endpoint-lock/unlock
     * Manually unlock the endpoint versions and optionally refresh.
     * Use this after tuning completes to switch to new endpoints.
     * Query param: ?refresh=true to force refresh the endpoint cache.
     */
    @PostMapping("/endpoint-lock/unlock")
    public ResponseEntity<ApiResponse<Map<String, Object>>> unlockEndpoints(
            @RequestParam(value = "refresh", defaultValue = "true") boolean refresh
    ) {
        Map<String, Object> result = classificationTuningAutoService.unlockEndpoints(refresh);
        String message = (Boolean.TRUE.equals(result.get("success")))
                ? "Endpoints unlocked successfully"
                : "Failed to unlock endpoints";
        return ResponseEntity.ok(ApiResponse.success(message, result));
    }

    /**
     * GET /api/admin/classification-tuning/samples
     * Return recent tuning samples for admin review.
     */
    @GetMapping("/samples")
    public ResponseEntity<ApiResponse<Map<String, Object>>> listSamples(
            @RequestParam(value = "limit", defaultValue = "50") int limit
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("items", classificationTuningService.listExamples(limit));
        payload.put("count", classificationTuningService.countExamples());
        payload.put("limit", limit);
        return ResponseEntity.ok(ApiResponse.success("Classification tuning samples", payload));
    }

    /**
     * DELETE /api/admin/classification-tuning/samples?confirm=true
     * Clear all tuning samples.
     */
    @DeleteMapping("/samples")
    public ResponseEntity<ApiResponse<Map<String, Object>>> clearSamples(
            @RequestParam(value = "confirm", defaultValue = "false") boolean confirm
    ) {
        if (!confirm) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("confirm=true is required to clear tuning samples"));
        }
        Map<String, Object> result = classificationTuningService.clearExamples();
        return ResponseEntity.ok(ApiResponse.success("Classification tuning samples cleared", result));
    }
}
