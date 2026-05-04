package com.dlp.platform.controller.admin;

import com.dlp.platform.service.vertex.VertexEndpointResolver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Internal API for triggering endpoint cache refresh.
 * Called by the Python tuning service after a tuning job completes
 * and the new endpoint is deployed.
 *
 * This allows the backend to discover the new endpoint without restart.
 *
 * Authentication: Uses a shared API key passed in X-Internal-Api-Key header.
 */
@Slf4j
@RestController
@RequestMapping("/internal/endpoint-refresh")
@RequiredArgsConstructor
public class EndpointRefreshController {

    private final VertexEndpointResolver vertexEndpointResolver;

    @Value("${internal.api-key:}")
    private String internalApiKey;

    /**
     * POST /internal/endpoint-refresh
     * Triggers a refresh of the Vertex endpoint cache.
     * Called by the Python tuning service after a tuning job completes.
     *
     * @param apiKey API key for authentication (via X-Internal-Api-Key header)
     * @param prefix Optional: specific endpoint prefix to refresh (e.g., "LLM_UEBA", "LLM_Classification")
     *               If not provided, all endpoints are refreshed.
     * @return refresh result with updated endpoints
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> refreshEndpoints(
            @RequestHeader(value = "X-Internal-Api-Key", required = false) String apiKey,
            @RequestParam(required = false) String prefix) {

        // Verify API key if configured
        if (internalApiKey != null && !internalApiKey.isBlank()) {
            if (apiKey == null || !internalApiKey.equals(apiKey)) {
                log.warn("Unauthorized endpoint refresh attempt");
                return ResponseEntity.status(401).body(Map.of(
                        "success", false,
                        "error", "Unauthorized"
                ));
            }
        }

        log.info("Endpoint refresh triggered via internal API, prefix={}", prefix);

        try {
            if (prefix != null && !prefix.isBlank()) {
                // Refresh specific prefix - need to fetch from tuning service
                String endpointId = vertexEndpointResolver.resolveEndpointId(prefix);
                Map<String, String> cached = vertexEndpointResolver.getCachedEndpoints();

                return ResponseEntity.ok(Map.of(
                        "success", true,
                        "prefix", prefix,
                        "endpointId", endpointId != null ? endpointId : "not found",
                        "allEndpoints", cached,
                        "timestamp", java.time.Instant.now().toString()
                ));
            } else {
                // Refresh all endpoints
                vertexEndpointResolver.refreshEndpointCache();
                Map<String, String> cached = vertexEndpointResolver.getCachedEndpoints();

                return ResponseEntity.ok(Map.of(
                        "success", true,
                        "message", "All endpoint caches refreshed",
                        "endpoints", cached,
                        "timestamp", java.time.Instant.now().toString()
                ));
            }
        } catch (Exception e) {
            log.error("Endpoint refresh failed: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }

    /**
     * GET /internal/endpoint-refresh/status
     * Returns current endpoint cache status.
     *
     * @param apiKey API key for authentication (via X-Internal-Api-Key header)
     * @return current endpoints and status
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus(
            @RequestHeader(value = "X-Internal-Api-Key", required = false) String apiKey) {

        // Verify API key if configured
        if (internalApiKey != null && !internalApiKey.isBlank()) {
            if (apiKey == null || !internalApiKey.equals(apiKey)) {
                return ResponseEntity.status(401).body(Map.of(
                        "success", false,
                        "error", "Unauthorized"
                ));
            }
        }

        return ResponseEntity.ok(Map.of(
                "cachedEndpoints", vertexEndpointResolver.getCachedEndpoints(),
                "versionLocked", vertexEndpointResolver.isVersionLocked(),
                "lockedEndpoints", vertexEndpointResolver.getLockedEndpoints(),
                "lastUpdateTime", vertexEndpointResolver.getLastUpdateTime(),
                "timestamp", java.time.Instant.now().toString()
        ));
    }
}
