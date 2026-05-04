package com.dlp.platform.service.classification;

import com.dlp.platform.service.vertex.VertexEndpointResolver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.HashMap;

/**
 * Automatically triggers a Vertex AI supervised fine-tuning job
 * when enough classification tuning examples have been collected.
 *
 * Naming convention: LLM_Classification_v0, LLM_Classification_v1, ...
 * Each run bumps the version so tuning jobs are isolated and discoverable
 * by the Python tuning service's state-file-based continual training.
 *
 * The actual tuning job creation is handled by the Python service using
 * Vertex AI SDK for Python (vertexai.tuning.sft).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ClassificationTuningAutoService {

    private final ClassificationTuningService classificationTuningService;
    private final VertexTuningUploadService vertexTuningUploadService;

    @Autowired(required = false)
    private VertexEndpointResolver vertexEndpointResolver;

    @Value("${vertex.tuning.min-examples:100}")
    private long minExamplesForAutoTuning;

    @Value("${vertex.tuning.tuning-service-url:}")
    private String tuningServiceUrl;

    /**
     * Backend callback URL for the Python service to notify when tuning completes.
     * The Python service will call this URL to trigger endpoint cache refresh.
     */
    @Value("${vertex.tuning.callback-url:}")
    private String callbackUrl;

    /**
     * API key for the callback endpoint authentication.
     * Sent to Python service so it can authenticate when calling the callback.
     */
    @Value("${internal.api-key:}")
    private String internalApiKey;

    @Value("${vertex.tuning.project-id:}")
    private String projectId;

    @Value("${vertex.tuning.location:us-central1}")
    private String location;

    @Value("${vertex.tuning.base-model:gemini-2.5-flash}")
    private String tuningBaseModel;

    @Value("${vertex.tuning.continual-training:true}")
    private boolean continualTraining;

    @Value("${vertex.tuning.auto-deploy:true}")
    private boolean autoDeploy;

    @Value("${vertex.tuning.endpoint-display-name:dlp-classification-endpoint}")
    private String endpointDisplayName;

    /** Explicit seed job ID for the very first tuning run (optional). */
    @Value("${vertex.tuning.seed-job-id:}")
    private String configuredSeedJobId;

    @Value("${vertex.tuning.scheduler.service-account-email:1070576772390-compute@developer.gserviceaccount.com}")
    private String schedulerServiceAccountEmail;

    @Value("${vertex.tuning.scheduler.time-zone:Asia/Hong_Kong}")
    private String schedulerTimeZone;

    @Value("${vertex.tuning.scheduler.cron:0 */2 * * *}")
    private String schedulerCron;

    /** Path to the Python service's state file for discovering prior succeeded jobs. */
    @Value("${vertex.tuning.python-state-file:}")
    private String pythonStateFile;

    /**
     * Current tuned-model version label (e.g. "v0", "v1").
     * Loaded from application.yml on startup; updated after each successful trigger.
     */
    @Value("${vertex.tuning.tuned-model-version:v0}")
    private String currentVersion;

    /** Next version to use for the following trigger. */
    private volatile String nextVersion;

    /**
     * Runtime toggle: when false, auto-trigger is skipped both for scheduled runs
     * and manual triggers. Defaults to true so the property is opt-out rather than opt-in.
     */
    @Value("${vertex.tuning.auto-enabled:true}")
    private boolean autoTuningEnabled = true;

    private static final String VERSION_FILE_PATH = "src/main/resources/vertex-classification-version.txt";

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    private volatile Map<String, Object> lastAutoTriggerResult;

    /** In-memory cache of latest succeeded job IDs per display name (loaded from Python state file). */
    private volatile Map<String, String> latestSucceededJobIds = new HashMap<>();

    @jakarta.annotation.PostConstruct
    public void loadState() {
        loadLatestSucceededFromPythonStateFile();
    }

    public Map<String, Object> getLastAutoTriggerResult() {
        return lastAutoTriggerResult;
    }

    public long getMinExamplesForAutoTuning() {
        return minExamplesForAutoTuning;
    }

    public void setMinExamplesForAutoTuning(long minExamples) {
        if (minExamples < 100) {
            throw new IllegalArgumentException("minExamples must be at least 100");
        }
        this.minExamplesForAutoTuning = minExamples;
        log.info("Classification min examples threshold set to {}", minExamples);
    }

    public boolean isAutoTuningEnabled() {
        return autoTuningEnabled;
    }

    public void setAutoTuningEnabled(boolean enabled) {
        this.autoTuningEnabled = enabled;
        log.info("Classification auto-tuning {}", enabled ? "ENABLED" : "DISABLED");
    }

    public String getCurrentVersionLabel() {
        return currentVersion;
    }

    public String getNextVersionLabel() {
        return nextVersion != null ? nextVersion : bumpVersion(currentVersion);
    }

    public boolean isContinualTraining() {
        return continualTraining;
    }

    public String getTuningBaseModel() {
        return tuningBaseModel;
    }

    @Scheduled(cron = "${vertex.tuning.auto-trigger-cron:0 0 3 * * ?}")
    public void scheduledAutoTriggerIfReady() {
        if (!autoTuningEnabled) {
            log.debug("Scheduled auto-trigger skipped: auto-tuning is disabled");
            return;
        }
        try {
            autoTriggerIfReady();
        } catch (Exception e) {
            log.warn("Scheduled auto-trigger failed (non-fatal): {}", e.getMessage());
        }
    }

    /**
     * Main entry point: check readiness, upload dataset, call tuning service.
     * Naming convention: LLM_Classification_{version} (e.g. LLM_Classification_v0).
     */
    public Map<String, Object> autoTriggerIfReady() {
        if (!autoTuningEnabled) {
            log.info("Auto-tuning is disabled via runtime toggle; skipping trigger");
            Map<String, Object> result = Map.of(
                    "triggered", false,
                    "reason", "AUTO_TUNING_DISABLED",
                    "autoTuningEnabled", false
            );
            lastAutoTriggerResult = result;
            return result;
        }

        long count = classificationTuningService.countExamples();
        if (count < minExamplesForAutoTuning) {
            log.info("Auto-tuning not triggered: {} examples collected < threshold {}",
                    count, minExamplesForAutoTuning);
            Map<String, Object> result = Map.of(
                    "triggered", false,
                    "reason", "NOT_ENOUGH_EXAMPLES",
                    "exampleCount", count,
                    "minExamples", minExamplesForAutoTuning
            );
            lastAutoTriggerResult = result;
            return result;
        }

        if (tuningServiceUrl == null || tuningServiceUrl.isBlank()) {
            log.warn("Auto-tuning service URL is not configured");
            return noopResult("TUNING_SERVICE_URL_NOT_CONFIGURED", count);
        }

        if (projectId == null || projectId.isBlank()) {
            log.warn("Vertex tuning project ID is not configured");
            return noopResult("PROJECT_ID_NOT_CONFIGURED", count);
        }

        // ── Lock current endpoint versions before tuning ─────────────────────
        Map<String, String> lockedEndpoints = null;
        if (vertexEndpointResolver != null) {
            try {
                lockedEndpoints = vertexEndpointResolver.lockEndpointVersions(
                        java.util.List.of(VertexEndpointResolver.CLASSIFICATION_PREFIX));
                log.info("Endpoint versions locked before tuning");
            } catch (Exception e) {
                log.warn("Failed to lock endpoint versions (continuing anyway): {}", e.getMessage());
            }
        }

        // ── Compute version label ───────────────────────────────────────────
        if (nextVersion == null) {
            nextVersion = bumpVersion(currentVersion);
        }
        String effectiveVersion = nextVersion;
        String bumpedNext = bumpVersion(nextVersion);

        // Display name: LLM_Classification_v0, LLM_Classification_v1, ...
        String displayName = "LLM_Classification_" + effectiveVersion;

        // ── Discover seed job ───────────────────────────────────────────────
        String effectiveSeedJobId = null;
        if (configuredSeedJobId != null && !configuredSeedJobId.isBlank()) {
            effectiveSeedJobId = configuredSeedJobId.trim();
            log.info("Using explicitly configured seedTuningJobId={}", effectiveSeedJobId);
        } else if (continualTraining) {
            String discovered = latestSucceededJobIds.get(displayName);
            if (discovered != null && !discovered.isBlank()) {
                effectiveSeedJobId = discovered;
                log.info("Discovered latest seed job for '{}': {}", displayName, effectiveSeedJobId);
            } else {
                log.info("No prior succeeded job found for '{}'; tuning from base model (first run)", displayName);
            }
        }

        // ── Step 1: export + upload to GCS ─────────────────────────────────
        Map<String, Object> uploadResult = vertexTuningUploadService.exportAndUploadToGcs();
        if (!Boolean.TRUE.equals(uploadResult.get("success"))) {
            log.warn("Auto-tuning upload failed: {}", uploadResult);

            // Unlock endpoints on upload failure
            if (vertexEndpointResolver != null && vertexEndpointResolver.isVersionLocked()) {
                try {
                    vertexEndpointResolver.unlockEndpointVersions(false);
                    log.info("Endpoint versions unlocked due to upload failure");
                } catch (Exception unlockEx) {
                    log.warn("Failed to unlock endpoints after upload failure: {}", unlockEx.getMessage());
                }
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("triggered", false);
            result.put("reason", "UPLOAD_FAILED");
            result.put("uploadResult", uploadResult);
            lastAutoTriggerResult = result;
            return result;
        }

        String gcsUri = (String) uploadResult.get("gcsUri");
        if (gcsUri == null || gcsUri.isBlank()) {
            log.info("No gcsUri from upload (likely no examples)");
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("triggered", false);
            result.put("reason", "NO_GCS_URI");
            result.put("uploadResult", uploadResult);
            lastAutoTriggerResult = result;
            return result;
        }

        // ── Step 2: call Python tuning service ─────────────────────────────
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("projectId", projectId);
        payload.put("location", location);
        payload.put("trainingDatasetUri", gcsUri);
        payload.put("baseModel", tuningBaseModel);
        payload.put("continualTraining", continualTraining);
        payload.put("autoDeploy", autoDeploy);
        payload.put("endpointDisplayName", endpointDisplayName);
        payload.put("tunedModelDisplayName", displayName);
        if (effectiveSeedJobId != null && !effectiveSeedJobId.isBlank()) {
            payload.put("seedTuningJobId", effectiveSeedJobId);
        }
        // Add callback URL so Python service can notify backend when tuning completes
        if (callbackUrl != null && !callbackUrl.isBlank()) {
            payload.put("callbackUrl", callbackUrl);
            // Also include the API key for callback authentication
            if (internalApiKey != null && !internalApiKey.isBlank()) {
                payload.put("callbackApiKey", internalApiKey);
            }
            log.debug("Including callback URL and API key in tuning request");
        }

        log.info("Calling tuning service {} with displayName={}, seedJobId={}, continualTraining={}",
                tuningServiceUrl, displayName, effectiveSeedJobId, continualTraining);

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(
                    tuningServiceUrl, entity, String.class
            );

            String responseBody = response.getBody();
            log.info("Tuning service response (status={}): {}", response.getStatusCode(), responseBody);

            String tuningJobResourceName = null;
            String jobId = null;
            try {
                if (responseBody != null && !responseBody.isBlank()) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> parsed = objectMapper.readValue(responseBody, Map.class);
                    Object job = parsed.get("tuningJobResourceName");
                    if (job != null) tuningJobResourceName = String.valueOf(job);
                    Object jid = parsed.get("jobId");
                    if (jid != null) {
                        jobId = String.valueOf(jid);
                    } else if (tuningJobResourceName != null && tuningJobResourceName.contains("/")) {
                        jobId = tuningJobResourceName.substring(tuningJobResourceName.lastIndexOf('/') + 1);
                    }
                }
            } catch (Exception ignored) { /* keep raw response */ }

            // Persist job to Python state file so future runs discover it as seed
            if (jobId != null && !jobId.isBlank()) {
                persistJobToPythonState(displayName, jobId);
                latestSucceededJobIds.put(displayName, jobId);
            }

            // Advance version: next trigger uses bumped label
            currentVersion = nextVersion;
            nextVersion = bumpedNext;
            persistVersionToFile(currentVersion);

            // Create Cloud Scheduler reconcile job
            Map<String, Object> schedulerResult = null;
            if (jobId != null && !jobId.isBlank()) {
                try {
                    schedulerResult = createReconcileSchedulerJob(jobId, displayName);
                } catch (Exception e) {
                    log.warn("Failed to create Cloud Scheduler reconcile job for {}: {}", jobId, e.getMessage());
                }
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("triggered", true);
            result.put("exampleCount", count);
            result.put("gcsUri", gcsUri);
            result.put("displayName", displayName);
            result.put("version", effectiveVersion);
            result.put("nextVersion", nextVersion);
            result.put("seedTuningJobId", effectiveSeedJobId != null ? effectiveSeedJobId : "none (base model)");
            result.put("continualTraining", continualTraining);
            result.put("tuningJobResourceName", tuningJobResourceName);
            result.put("jobId", jobId);
            result.put("scheduler", schedulerResult);
            result.put("tuningServiceResponse", responseBody);
            result.put("statusCode", response.getStatusCode().value());
            result.put("endpointsLocked", lockedEndpoints);
            result.put("endpointLockMessage", "Endpoint was locked during tuning job creation. " +
                    "The reconcile scheduler will refresh endpoints when the tuning job completes.");
            lastAutoTriggerResult = result;

            // NOTE: We do NOT unlock here. The Python reconcile job will handle unlocking
            // when the tuning job completes and deploys the new endpoint.
            // If you want immediate unlock after job creation (not recommended), call:
            // vertexEndpointResolver.unlockEndpointVersions(true);

            return result;

        } catch (Exception e) {
            log.warn("Error calling tuning service: {}", e.getMessage());
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("triggered", false);
            result.put("reason", "TUNING_SERVICE_CALL_FAILED");
            result.put("gcsUri", gcsUri);
            result.put("error", e.getMessage());
            lastAutoTriggerResult = result;

            // Unlock endpoints on failure so we can retry
            if (vertexEndpointResolver != null && vertexEndpointResolver.isVersionLocked()) {
                try {
                    vertexEndpointResolver.unlockEndpointVersions(false);
                    log.info("Endpoint versions unlocked due to tuning failure");
                } catch (Exception unlockEx) {
                    log.warn("Failed to unlock endpoints after failure: {}", unlockEx.getMessage());
                }
            }

            return result;
        }
    }

    // ── Version management ─────────────────────────────────────────────────────

    private String bumpVersion(String version) {
        if (version == null || version.isBlank()) return "v1";
        String stripped = version.startsWith("v") ? version.substring(1) : version;
        if (stripped.contains(".")) {
            String[] parts = stripped.split("\\.");
            try {
                int patch = Integer.parseInt(parts[parts.length - 1]);
                return parts[0] + "." + (patch + 1);
            } catch (NumberFormatException e) {
                return "v" + stripped + ".1";
            }
        }
        try {
            int major = Integer.parseInt(stripped);
            return "v" + (major + 1);
        } catch (NumberFormatException e) {
            return "v" + stripped + "1";
        }
    }

    private void persistVersionToFile(String version) {
        try {
            Path path = Path.of(VERSION_FILE_PATH);
            java.nio.file.Files.writeString(path, version, StandardCharsets.UTF_8);
            log.info("Persisted tuned-model version={} to {}", version, VERSION_FILE_PATH);
        } catch (Exception e) {
            log.warn("Could not persist version to {}: {}", VERSION_FILE_PATH, e.getMessage());
        }
    }

    // ── Python state file helpers ─────────────────────────────────────────────

    /**
     * Load the latest succeeded job IDs from the Python service's state file.
     * This lets us discover prior tuning jobs for continual training.
     */
    private void loadLatestSucceededFromPythonStateFile() {
        String stateFile = resolvePythonStateFile();
        if (stateFile == null) {
            log.debug("No Python state file found, starting from base model");
            return;
        }

        Path path = Path.of(stateFile);
        if (!java.nio.file.Files.exists(path)) return;

        try {
            String content = java.nio.file.Files.readString(path, StandardCharsets.UTF_8);
            JsonNode root = objectMapper.readTree(content);
            JsonNode jobs = root.get("jobs");
            if (jobs == null || !jobs.isArray()) return;

            for (JsonNode job : jobs) {
                String state = job.path("state").asText(null);
                String displayName = job.path("displayName").asText(null);
                String resourceName = job.path("tuningJobResourceName").asText(null);
                if ("JOB_STATE_SUCCEEDED".equals(state)
                        && displayName != null && !displayName.isBlank()
                        && resourceName != null && !resourceName.isBlank()) {
                    String jobId = resourceName.contains("/")
                            ? resourceName.substring(resourceName.lastIndexOf('/') + 1)
                            : resourceName;
                    latestSucceededJobIds.put(displayName, jobId);
                    log.info("Loaded classification succeeded job: displayName={}, jobId={}", displayName, jobId);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to load state from {}: {}", stateFile, e.getMessage());
        }
    }

    private String resolvePythonStateFile() {
        if (pythonStateFile != null && !pythonStateFile.isBlank()) return pythonStateFile;
        String[] candidates = {
                "../tuning-service-python/tuning-jobs-state.json",
                "tuning-service-python/tuning-jobs-state.json",
                "/app/tuning-service-python/tuning-jobs-state.json",
                System.getProperty("user.dir") + "/tuning-service-python/tuning-jobs-state.json"
        };
        for (String c : candidates) {
            if (java.nio.file.Files.exists(Path.of(c))) return c;
        }
        return null;
    }

    private void persistJobToPythonState(String displayName, String jobId) {
        String stateFile = resolvePythonStateFile();
        if (stateFile == null) return;

        Path path = Path.of(stateFile);
        try {
            JsonNode root;
            if (java.nio.file.Files.exists(path)) {
                String content = java.nio.file.Files.readString(path, StandardCharsets.UTF_8);
                root = objectMapper.readTree(content);
            } else {
                root = objectMapper.createObjectNode();
                ((com.fasterxml.jackson.databind.node.ObjectNode) root).putArray("jobs");
            }

            JsonNode jobsNode = root.get("jobs");
            if (jobsNode == null || !jobsNode.isArray()) {
                jobsNode = ((com.fasterxml.jackson.databind.node.ObjectNode) root).putArray("jobs");
            }

            com.fasterxml.jackson.databind.node.ObjectNode target = null;
            for (JsonNode j : jobsNode) {
                if (displayName.equals(j.path("displayName").asText(null))) {
                    target = (com.fasterxml.jackson.databind.node.ObjectNode) j;
                    break;
                }
            }
            if (target == null) {
                target = ((com.fasterxml.jackson.databind.node.ArrayNode) jobsNode).addObject();
            }
            target.put("displayName", displayName);
            target.put("tuningJobResourceName",
                    "projects/" + projectId + "/locations/" + location + "/tuningJobs/" + jobId);
            target.put("state", "JOB_STATE_PENDING");
            target.put("createdAt", java.time.Instant.now().toString());

            java.nio.file.Files.writeString(path,
                    objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(root),
                    StandardCharsets.UTF_8);
            log.info("Persisted classification job to Python state file: displayName={}, jobId={}", displayName, jobId);
        } catch (Exception e) {
            log.warn("Could not persist job to Python state file {}: {}", stateFile, e.getMessage());
        }
    }

    // ── Cloud Scheduler ────────────────────────────────────────────────────────

    private Map<String, Object> createReconcileSchedulerJob(String jobId, String displayName) throws Exception {
        if (tuningServiceUrl == null || tuningServiceUrl.isBlank()) {
            throw new IllegalStateException("tuningServiceUrl not configured");
        }

        String baseUrl = tuningServiceUrl;
        if (baseUrl.endsWith("/start")) {
            baseUrl = baseUrl.substring(0, baseUrl.length() - "/start".length());
        }
        String reconcileUri = baseUrl + "/reconcile/" + jobId;
        String safeName = "clf-" + displayName.replaceAll("[^a-zA-Z0-9\\-]", "-").toLowerCase();
        if (safeName.length() > 64) safeName = safeName.substring(0, 64);
        String jobName = safeName;

        log.info("Creating Cloud Scheduler job '{}' for reconcile URI {}", jobName, reconcileUri);

        ProcessBuilder pb = new ProcessBuilder(
                "gcloud", "scheduler", "jobs", "create", "http", jobName,
                "--schedule=" + schedulerCron,
                "--time-zone=" + schedulerTimeZone,
                "--http-method=POST",
                "--uri=" + reconcileUri,
                "--oauth-service-account-email=" + schedulerServiceAccountEmail,
                "--oauth-token-scope=https://www.googleapis.com/auth/cloud-platform"
        );
        pb.redirectErrorStream(true);
        Process process = pb.start();

        StringBuilder output = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append('\n');
            }
        }
        int exitCode = process.waitFor();
        String outputText = output.toString();

        if (exitCode != 0) {
            log.warn("gcloud scheduler jobs create http exited with code {}. Output:\n{}", exitCode, outputText);
            return Map.of("success", false, "jobName", jobName, "exitCode", exitCode, "output", outputText);
        }

        log.info("Cloud Scheduler job '{}' created successfully.", jobName);
        return Map.of(
                "success", true,
                "jobName", jobName,
                "uri", reconcileUri,
                "schedule", schedulerCron,
                "timeZone", schedulerTimeZone
        );
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Map<String, Object> noopResult(String reason, long count) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("triggered", false);
        result.put("reason", reason);
        result.put("exampleCount", count);
        lastAutoTriggerResult = result;
        return result;
    }

    // ── Endpoint Lock Management ────────────────────────────────────────────────

    /**
     * Manually lock endpoint versions.
     * Useful when you want to ensure stability during manual tuning operations.
     */
    public Map<String, Object> lockEndpoints() {
        Map<String, Object> response = new LinkedHashMap<>();
        if (vertexEndpointResolver == null) {
            response.put("success", false);
            response.put("message", "VertexEndpointResolver not available");
            return response;
        }

        if (vertexEndpointResolver.isVersionLocked()) {
            response.put("success", false);
            response.put("message", "Endpoints are already locked");
            response.put("lockedEndpoints", vertexEndpointResolver.getLockedEndpoints());
            return response;
        }

        Map<String, String> locked = vertexEndpointResolver.lockEndpointVersions(
                java.util.List.of(
                        VertexEndpointResolver.CLASSIFICATION_PREFIX,
                        VertexEndpointResolver.UEBA_PREFIX
                ));
        response.put("success", true);
        response.put("message", "Endpoints locked successfully");
        response.put("lockedEndpoints", locked);
        return response;
    }

    /**
     * Manually unlock endpoint versions and optionally refresh.
     * Call this after manual tuning completes to switch to new endpoints.
     */
    public Map<String, Object> unlockEndpoints(boolean refresh) {
        Map<String, Object> response = new LinkedHashMap<>();
        if (vertexEndpointResolver == null) {
            response.put("success", false);
            response.put("message", "VertexEndpointResolver not available");
            return response;
        }

        if (!vertexEndpointResolver.isVersionLocked()) {
            response.put("success", false);
            response.put("message", "Endpoints are not locked");
            return response;
        }

        Map<String, String> previousLocked = vertexEndpointResolver.getLockedEndpoints();
        Map<String, String> newEndpoints = vertexEndpointResolver.unlockEndpointVersions(refresh);
        response.put("success", true);
        response.put("message", "Endpoints unlocked successfully");
        response.put("previouslyLocked", previousLocked);
        response.put("newEndpoints", newEndpoints);
        response.put("refreshed", refresh);
        return response;
    }

    /**
     * Get current endpoint lock status.
     */
    public Map<String, Object> getEndpointLockStatus() {
        Map<String, Object> status = new LinkedHashMap<>();
        if (vertexEndpointResolver == null) {
            status.put("available", false);
            status.put("message", "VertexEndpointResolver not available");
            return status;
        }

        status.put("available", true);
        status.put("versionLocked", vertexEndpointResolver.isVersionLocked());
        status.put("lockedEndpoints", vertexEndpointResolver.getLockedEndpoints());
        status.put("cachedEndpoints", vertexEndpointResolver.getCachedEndpoints());
        status.put("lastUpdateTime", vertexEndpointResolver.getLastUpdateTime());
        return status;
    }
}
