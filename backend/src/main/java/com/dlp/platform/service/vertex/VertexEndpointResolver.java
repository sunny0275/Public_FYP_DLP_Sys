package com.dlp.platform.service.vertex;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import jakarta.annotation.PostConstruct;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;

/**
 * Dynamically resolves tuned model endpoint IDs from the Python tuning service.
 * This eliminates the need to hardcode endpoint IDs or restart the application
 * after new tuning jobs complete.
 *
 * The tuning service provides these endpoints:
 * - GET /latest/{displayNamePrefix} - Get latest deployed endpoint for a prefix
 * - GET /endpoints - List all deployed endpoints
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class VertexEndpointResolver {

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${vertex.tuning.tuning-service-url:}")
    private String tuningServiceUrl;

    /** Cache of displayNamePrefix -> endpoint ID */
    private final ConcurrentHashMap<String, String> endpointCache = new ConcurrentHashMap<>();

    /** Locked endpoint IDs (override cache during tuning) */
    private final ConcurrentHashMap<String, String> lockedEndpoints = new ConcurrentHashMap<>();

    /** Version lock state - when true, uses locked endpoints instead of cache */
    private final AtomicBoolean versionLocked = new AtomicBoolean(false);

    /** Timestamp of last successful cache update */
    private final AtomicReference<String> lastUpdateTime = new AtomicReference<>(null);

    /** Callbacks to invoke after successful endpoint refresh */
    private final ConcurrentHashMap<String, Consumer<Map<String, String>>> refreshCallbacks = new ConcurrentHashMap<>();

    public static final String CLASSIFICATION_PREFIX = "LLM_Classification";
    public static final String UEBA_PREFIX = "LLM_UEBA";

    @PostConstruct
    public void init() {
        refreshEndpointCache();
    }

    /**
     * Periodically refresh the endpoint cache (once per day).
     * This ensures the backend always uses the latest deployed endpoint.
     * During tuning, the cache is locked to avoid using unstable endpoints.
     */
    @Scheduled(fixedRate = 86400000) // 24 hours (1 day)
    public void scheduledRefresh() {
        if (versionLocked.get()) {
            log.debug("Skipping scheduled refresh: endpoint version is locked during tuning");
            return;
        }
        refreshEndpointCache();
    }

    /**
     * Force refresh the endpoint cache immediately.
     * Also triggers registered callbacks after successful refresh.
     */
    public void refreshEndpointCache() {
        if (tuningServiceUrl == null || tuningServiceUrl.isBlank()) {
            log.debug("Tuning service URL not configured, skipping endpoint resolution");
            return;
        }

        try {
            String endpointsUrl = tuningServiceUrl.replace("/start", "") + "/endpoints";
            String response = restTemplate.getForObject(endpointsUrl, String.class);

            if (response == null || response.isBlank()) {
                log.warn("Empty response from tuning service endpoints");
                return;
            }

            JsonNode root = objectMapper.readTree(response);
            JsonNode endpoints = root.get("endpoints");

            if (endpoints == null || !endpoints.isObject()) {
                log.debug("No endpoints found in tuning service response");
                return;
            }

            int updated = 0;
            java.util.Iterator<java.util.Map.Entry<String, JsonNode>> fieldIterator = endpoints.fields();
            while (fieldIterator.hasNext()) {
                java.util.Map.Entry<String, JsonNode> entry = fieldIterator.next();
                String prefix = entry.getKey();
                JsonNode endpointInfo = entry.getValue();
                String endpointId = endpointInfo.path("endpointId").asText(null);

                if (endpointId != null && !endpointId.isBlank()) {
                    String previous = endpointCache.put(prefix, endpointId);
                    if (!endpointId.equals(previous)) {
                        log.info("Updated endpoint cache: {} -> {}", prefix, endpointId);
                        updated++;
                    }
                }
            }

            if (updated > 0) {
                lastUpdateTime.set(java.time.Instant.now().toString());
                log.info("Endpoint cache refreshed: {} endpoints updated", updated);

                // Trigger callbacks after successful refresh
                if (!refreshCallbacks.isEmpty()) {
                    Map<String, String> snapshot = getCachedEndpoints();
                    refreshCallbacks.values().forEach(callback -> {
                        try {
                            callback.accept(snapshot);
                        } catch (Exception e) {
                            log.warn("Refresh callback failed: {}", e.getMessage());
                        }
                    });
                }
            }

        } catch (Exception e) {
            log.warn("Failed to refresh endpoint cache: {}", e.getMessage());
        }
    }

    /**
     * Get the latest deployed endpoint ID for the classification service.
     * Falls back to configured VERTEX_ENDPOINT_ID if not available.
     */
    public String getClassificationEndpointId() {
        return getEndpointId(CLASSIFICATION_PREFIX);
    }

    /**
     * Get the latest deployed endpoint ID for the UEBA service.
     * Falls back to configured LLM_UEBA_ENDPOINT_ID if not available.
     */
    public String getUebaEndpointId() {
        return getEndpointId(UEBA_PREFIX);
    }

    /**
     * Get the endpoint ID for a specific display name prefix.
     * Returns null if not cached and fallbackValue is null.
     */
    public String getEndpointId(String displayNamePrefix) {
        String cached = endpointCache.get(displayNamePrefix);
        if (cached != null && !cached.isBlank()) {
            return cached;
        }

        // Try to fetch just this prefix
        if (tuningServiceUrl != null && !tuningServiceUrl.isBlank()) {
            try {
                String latestUrl = tuningServiceUrl.replace("/start", "") + "/latest/" + displayNamePrefix;
                String response = restTemplate.getForObject(latestUrl, String.class);

                if (response != null && !response.isBlank()) {
                    JsonNode root = objectMapper.readTree(response);
                    String endpointId = root.path("endpointId").asText(null);
                    if (endpointId != null && !endpointId.isBlank()) {
                        endpointCache.put(displayNamePrefix, endpointId);
                        return endpointId;
                    }
                }
            } catch (Exception e) {
                log.debug("Failed to fetch latest endpoint for {}: {}", displayNamePrefix, e.getMessage());
            }
        }

        return cached;
    }

    /**
     * Check if the endpoint cache has been populated.
     */
    public boolean hasEndpoints() {
        return !endpointCache.isEmpty();
    }

    /**
     * Get all cached endpoints (for debugging/monitoring).
     */
    public Map<String, String> getCachedEndpoints() {
        return Map.copyOf(endpointCache);
    }

    /**
     * Get the last update timestamp.
     */
    public String getLastUpdateTime() {
        return lastUpdateTime.get();
    }

    // ==================== Version Locking for Tuning ====================

    /**
     * Lock the current endpoint versions before starting a new tuning job.
     * This ensures the service uses stable endpoints during the tuning process.
     *
     * @param prefixesToLock list of prefixes to lock (e.g., "LLM_Classification", "LLM_UEBA")
     * @return map of locked prefix -> endpoint ID
     */
    public Map<String, String> lockEndpointVersions(java.util.List<String> prefixesToLock) {
        // First refresh to get latest endpoints
        refreshEndpointCache();

        Map<String, String> locked = new java.util.LinkedHashMap<>();
        for (String prefix : prefixesToLock) {
            String endpointId = endpointCache.get(prefix);
            if (endpointId != null && !endpointId.isBlank()) {
                lockedEndpoints.put(prefix, endpointId);
                locked.put(prefix, endpointId);
                log.info("Locked endpoint for '{}': {}", prefix, endpointId);
            } else {
                log.warn("Cannot lock endpoint for '{}': not found in cache", prefix);
            }
        }

        if (!locked.isEmpty()) {
            versionLocked.set(true);
            log.info("Endpoint versions LOCKED. {} endpoints locked during tuning.", locked.size());
        }

        return locked;
    }

    /**
     * Unlock endpoint versions and refresh cache after tuning completes.
     * This allows the service to use the newly deployed endpoints.
     *
     * @param forceRefresh if true, forces a cache refresh after unlock
     * @return map of new endpoints after refresh
     */
    public Map<String, String> unlockEndpointVersions(boolean forceRefresh) {
        Map<String, String> previousLocked = new java.util.LinkedHashMap<>(lockedEndpoints);

        lockedEndpoints.clear();
        versionLocked.set(false);
        log.info("Endpoint versions UNLOCKED. Previously locked: {}", previousLocked);

        if (forceRefresh) {
            refreshEndpointCache();
        }

        return getCachedEndpoints();
    }

    /**
     * Check if endpoint versions are currently locked.
     */
    public boolean isVersionLocked() {
        return versionLocked.get();
    }

    /**
     * Get currently locked endpoints.
     */
    public Map<String, String> getLockedEndpoints() {
        return Map.copyOf(lockedEndpoints);
    }

    /**
     * Register a callback to be invoked after endpoint cache refresh.
     *
     * @param key unique identifier for this callback
     * @param callback consumer that receives the updated endpoint map
     */
    public void registerRefreshCallback(String key, Consumer<Map<String, String>> callback) {
        refreshCallbacks.put(key, callback);
        log.debug("Registered refresh callback: {}", key);
    }

    /**
     * Unregister a previously registered callback.
     *
     * @param key the callback key to remove
     */
    public void unregisterRefreshCallback(String key) {
        refreshCallbacks.remove(key);
        log.debug("Unregistered refresh callback: {}", key);
    }

    /**
     * Get endpoint ID, respecting version lock.
     * If locked, returns the locked endpoint; otherwise returns cached endpoint.
     */
    public String resolveEndpointId(String displayNamePrefix) {
        // Check locked endpoints first
        String locked = lockedEndpoints.get(displayNamePrefix);
        if (locked != null && !locked.isBlank()) {
            log.debug("Using LOCKED endpoint for '{}': {}", displayNamePrefix, locked);
            return locked;
        }

        // Fall back to cache resolution
        String cached = endpointCache.get(displayNamePrefix);
        if (cached != null && !cached.isBlank()) {
            return cached;
        }

        // Try to fetch just this prefix
        if (tuningServiceUrl != null && !tuningServiceUrl.isBlank()) {
            try {
                String latestUrl = tuningServiceUrl.replace("/start", "") + "/latest/" + displayNamePrefix;
                String response = restTemplate.getForObject(latestUrl, String.class);

                if (response != null && !response.isBlank()) {
                    JsonNode root = objectMapper.readTree(response);
                    String endpointId = root.path("endpointId").asText(null);
                    if (endpointId != null && !endpointId.isBlank()) {
                        endpointCache.put(displayNamePrefix, endpointId);
                        return endpointId;
                    }
                }
            } catch (Exception e) {
                log.debug("Failed to fetch latest endpoint for {}: {}", displayNamePrefix, e.getMessage());
            }
        }

        return cached;
    }

    /**
     * Get comprehensive status including lock state.
     */
    public Map<String, Object> getDetailedStatus() {
        Map<String, Object> status = new java.util.LinkedHashMap<>();
        status.put("versionLocked", versionLocked.get());
        status.put("lockedEndpoints", getLockedEndpoints());
        status.put("cachedEndpoints", getCachedEndpoints());
        status.put("lastUpdateTime", getLastUpdateTime());
        status.put("callbacksRegistered", refreshCallbacks.keySet());
        return status;
    }
}
