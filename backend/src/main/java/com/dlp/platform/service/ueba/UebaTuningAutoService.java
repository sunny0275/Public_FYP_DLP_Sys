package com.dlp.platform.service.ueba;

import com.dlp.platform.service.vertex.VertexEndpointResolver;
import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageOptions;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Automatically triggers a Vertex AI supervised fine-tuning job for UEBA
 * when enough tuning examples have been collected (min 100).
 *
 * Steps:
 * 1. Export UEBA examples to JSONL
 * 2. Upload to GCS
 * 3. Call the Python tuning service to start a Vertex AI supervised tuning job
 * 4. The tuned model is auto-deployed to a dedicated UEBA endpoint
 * 5. The Python service calls back to refresh the endpoint cache (no restart needed)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UebaTuningAutoService {

    private final UebaTuningService uebaTuningService;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired(required = false)
    private VertexEndpointResolver vertexEndpointResolver;

    @Value("${llm-ueba.tuning.enabled:true}")
    private boolean tuningEnabled;

    public boolean isTuningEnabled() {
        return tuningEnabled;
    }

    public void setTuningEnabled(boolean enabled) {
        this.tuningEnabled = enabled;
        log.info("UEBA auto-tuning {}", enabled ? "ENABLED" : "DISABLED");
    }

    @Value("${llm-ueba.tuning.min-examples:1000}")
    private long minExamplesForAutoTuning;

    @Value("${llm-ueba.tuning.gcs-bucket:}")
    private String gcsBucket;

    @Value("${llm-ueba.tuning.object-prefix:tuning/ueba/}")
    private String objectPrefix;

    @Value("${llm-ueba.tuning.project-id:}")
    private String tuningProjectId;

    @Value("${llm-ueba.tuning.location:us-central1}")
    private String tuningLocation;

    @Value("${llm-ueba.tuning.base-model:gemini-2.5-flash}")
    private String tuningBaseModel;

    @Value("${llm-ueba.tuning.auto-deploy:true}")
    private boolean autoDeploy;

    @Value("${llm-ueba.tuning.endpoint-display-name:dlp-ueba-endpoint}")
    private String endpointDisplayName;

    @Value("${llm-ueba.tuning.tuning-service-url:}")
    private String tuningServiceUrl;

    /**
     * Backend callback URL for the Python service to notify when tuning completes.
     * The Python service will call this URL to trigger endpoint cache refresh.
     */
    @Value("${llm-ueba.tuning.callback-url:}")
    private String callbackUrl;

    /**
     * API key for the callback endpoint authentication.
     * Sent to Python service so it can authenticate when calling the callback.
     */
    @Value("${internal.api-key:}")
    private String internalApiKey;

    /** In-memory cache for the latest auto-trigger result (for admin dashboard) */
    private volatile Map<String, Object> lastAutoTriggerResult;

    // ── Continual-training / seed-job support ─────────────────────────────────

    /**
     * When true, each auto-tuning run tunes from the previously-tuned UEBA model
     * (found via state-file or Vertex AI), creating a compounding improvement.
     * Matches the document-classification tuning strategy.
     */
    @Value("${llm-ueba.tuning.continual-training:true}")
    private boolean continualTraining;

    /**
     * Explicit seed job ID for the first tuning run.
     * After the first tuning completes, subsequent runs discover the seed
     * automatically from the Python service's state file.
     */
    @Value("${llm-ueba.tuning.seed-job-id:}")
    private String seedTuningJobId;

    /** Path to the Python service's state file on the local/attached filesystem. */
    @Value("${llm-ueba.tuning.python-state-file:}")
    private String pythonStateFile;

    // ── Version management ────────────────────────────────────────────────────

    /**
     * Current tuned-model version label (e.g. "v0", "v1").
     * Incremented each time a tuning job SUCCEEDS.
     * Loaded from application.yml on startup; updated by {@link #markVersionUpdated(String)}.
     */
    @Value("${llm-ueba.tuning.tuned-model-version:v0}")
    private String currentVersion;

    /**
     * Next version to use when the current tuning run completes.
     * Computed from {@link #currentVersion} at the start of each trigger.
     */
    private volatile String nextVersion;

    private static final String VERSION_FILE_PATH =
            "src/main/resources/llm-ueba-tuned-version.txt";

    // ── Scheduler / Cloud Scheduler config ───────────────────────────────────

    @Value("${llm-ueba.tuning.scheduler.service-account-email:}")
    private String schedulerServiceAccountEmail;

    @Value("${llm-ueba.tuning.scheduler.time-zone:Asia/Hong_Kong}")
    private String schedulerTimeZone;

    /**
     * Cron for reconcile check. Default every 2 hours.
     */
    @Value("${llm-ueba.tuning.scheduler.reconcile-cron:0 */2 * * *}")
    private String reconcileCron;

    /**
     * Mapping of the latest succeeded Vertex tuning job ID per display-name.
     * Populated at startup from the Python service state file (if present).
     * Updated after each successful trigger.
     */
    private volatile Map<String, String> latestSucceededJobIds = new HashMap<>();

    // ── Lifecycle: load state at construction ─────────────────────────────────

    /**
     * Load succeeded job IDs from the Python service state file on startup.
     * This allows the Java side to discover the seed job without needing
     * the Python service to be queried every time.
     */
    @jakarta.annotation.PostConstruct
    public void loadStateFromPythonService() {
        loadLatestSucceededFromStateFile();
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
        log.info("UEBA min examples threshold set to {}", minExamples);
    }

    /**
     * Returns the current version label (e.g. "v0", "v1").
     */
    public String getCurrentVersionLabel() {
        return currentVersion;
    }

    /**
     * Returns the next version label that will be used for the following trigger.
     */
    public String getNextVersionLabel() {
        return nextVersion != null ? nextVersion : bumpVersion(currentVersion);
    }

    /**
     * Scheduled check: runs daily at 4am (configured via llm-ueba.tuning.auto-trigger-cron).
     * Only triggers if:
     * - tuning is enabled
     * - at least min-examples (100) have been collected
     * - GCS bucket is configured
     * - tuning service URL is configured
     */
    @Scheduled(cron = "${llm-ueba.tuning.auto-trigger-cron:0 0 4 * * ?}")
    public void scheduledAutoTriggerIfReady() {
        if (!tuningEnabled) {
            log.debug("UEBA auto-tuning is disabled");
            return;
        }
        try {
            autoTriggerIfReady();
        } catch (Exception e) {
            log.warn("Scheduled UEBA auto-trigger failed (non-fatal): {}", e.getMessage());
        }
    }

    /**
     * Check if enough examples exist; if yes, export + upload + trigger tuning job.
     *
     * Continual-training strategy (mirrors document-classification tuning):
     * 1. seedTuningJobId configured? → use that specific job's tuned model
     * 2. Discover latest succeeded job for "dlp-ueba-endpoint" from Python state file
     * 3. If none found → use baseModel (gemini-2.5-flash) for first run
     *
     * @return result map for API response / logging
     */
    public Map<String, Object> autoTriggerIfReady() {
        long count = uebaTuningService.countExamples();

        if (count < minExamplesForAutoTuning) {
            log.info("UEBA auto-tuning not triggered: {} examples collected < threshold {}",
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
            log.warn("UEBA tuning service URL not configured (llm-ueba.tuning.tuning-service-url)");
            Map<String, Object> result = Map.of(
                    "triggered", false,
                    "reason", "TUNING_SERVICE_URL_NOT_CONFIGURED",
                    "exampleCount", count
            );
            lastAutoTriggerResult = result;
            return result;
        }

        if (tuningProjectId == null || tuningProjectId.isBlank()) {
            log.warn("UEBA tuning project ID not configured (llm-ueba.tuning.project-id)");
            Map<String, Object> result = Map.of(
                    "triggered", false,
                    "reason", "PROJECT_ID_NOT_CONFIGURED",
                    "exampleCount", count
            );
            lastAutoTriggerResult = result;
            return result;
        }

        // ── Compute next version label ─────────────────────────────────────────
        // currentVersion is injected from application.yml (e.g. "v0").
        // After this job completes the next trigger will use v1, then v1.1, etc.
        String effectiveVersion = currentVersion;
        if (nextVersion == null) {
            nextVersion = bumpVersion(currentVersion);
        }
        effectiveVersion = nextVersion;
        // Bump again so two successive triggers within the same session get distinct names
        String bumpedNext = bumpVersion(nextVersion);

        // ── Compute display name (includes version) ────────────────────────────
        // The Python service uses this as the key for finding the latest succeeded job,
        // so "LLM_UEBA_v0" ≠ "LLM_UEBA_v1" and won't bleed into each other's history.
        String effectiveDisplayName = "LLM_UEBA_" + effectiveVersion;

        // ── Discover seed job ──────────────────────────────────────────────────
        // Priority: explicit seed-job-id config > latest succeeded from state file
        String effectiveSeedJobId = null;
        if (seedTuningJobId != null && !seedTuningJobId.isBlank()) {
            effectiveSeedJobId = seedTuningJobId.trim();
            log.info("Using explicitly configured seedTuningJobId={}", effectiveSeedJobId);
        } else if (continualTraining) {
            String discovered = latestSucceededJobIds.get(effectiveDisplayName);
            if (discovered != null && !discovered.isBlank()) {
                effectiveSeedJobId = discovered;
                log.info("Discovered latest seed job for '{}': {}", effectiveDisplayName, effectiveSeedJobId);
            } else {
                log.info("No prior succeeded job found for '{}'; will tune from base model (first run)",
                        effectiveDisplayName);
            }
        }

        // ── Step 1: export + upload to GCS ───────────────────────────────────
        Map<String, Object> uploadResult = exportAndUploadToGcs();
        boolean uploadSuccess = (boolean) uploadResult.getOrDefault("success", false);
        if (!uploadSuccess) {
            log.warn("UEBA auto-tuning upload failed: {}", uploadResult);
            Map<String, Object> result = Map.of(
                    "triggered", false,
                    "reason", "UPLOAD_FAILED",
                    "uploadResult", uploadResult
            );
            lastAutoTriggerResult = result;
            return result;
        }

        String gcsUri = (String) uploadResult.get("gcsUri");
        if (gcsUri == null || gcsUri.isBlank()) {
            log.info("No gcsUri from upload (likely no examples). Upload result: {}", uploadResult);
            Map<String, Object> result = Map.of(
                    "triggered", false,
                    "reason", "NO_GCS_URI",
                    "uploadResult", uploadResult
            );
            lastAutoTriggerResult = result;
            return result;
        }

        // ── Step 2: call Python tuning service ───────────────────────────────
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("projectId", tuningProjectId);
        payload.put("location", tuningLocation);
        payload.put("trainingDatasetUri", gcsUri);
        payload.put("baseModel", tuningBaseModel);
        payload.put("continualTraining", continualTraining);
        payload.put("autoDeploy", autoDeploy);
        payload.put("displayName", effectiveDisplayName);      // versioned, e.g. "LLM_UEBA_v0"
        payload.put("endpointDisplayName", endpointDisplayName);
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

        log.info("Calling UEBA tuning service {} with displayName={}, seedJobId={}, continualTraining={}",
                tuningServiceUrl, effectiveDisplayName, effectiveSeedJobId, continualTraining);

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(
                    tuningServiceUrl,
                    entity,
                    String.class
            );

            String responseBody = response.getBody();
            log.info("UEBA tuning service response (status={}): {}", response.getStatusCode(), responseBody);

            String tuningJobResourceName = null;
            String jobId = null;
            String deployedEndpointId = null;
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
                        jobId = tuningJobResourceName.split("/")[tuningJobResourceName.split("/").length - 1];
                    }
                    Object epId = parsed.get("deployedEndpointId");
                    if (epId != null) deployedEndpointId = String.valueOf(epId);
                }
            } catch (Exception ignored) { /* keep raw response */ }

            // Persist the job ID to Python state file so subsequent runs find it as seed
            if (jobId != null && !jobId.isBlank()) {
                persistJobToPythonState(effectiveDisplayName, jobId);
                // Also update in-memory cache
                latestSucceededJobIds.put(effectiveDisplayName, jobId);
            }

            // Advance version: next run uses the next version label
            currentVersion = nextVersion;
            nextVersion = bumpedNext;
            persistVersionToFile(currentVersion);

            // Create Cloud Scheduler reconcile job for this tuning job
            Map<String, Object> schedulerResult = null;
            if (jobId != null && !jobId.isBlank()) {
                try {
                    schedulerResult = createReconcileSchedulerJob(jobId, effectiveDisplayName);
                } catch (Exception e) {
                    log.warn("Failed to create Cloud Scheduler reconcile job for tuning job {}: {}",
                            jobId, e.getMessage());
                }
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("triggered", true);
            result.put("exampleCount", count);
            result.put("gcsUri", gcsUri);
            result.put("displayName", effectiveDisplayName);
            result.put("version", effectiveVersion);
            result.put("nextVersion", nextVersion);
            result.put("seedTuningJobId", effectiveSeedJobId != null ? effectiveSeedJobId : "none (base model)");
            result.put("continualTraining", continualTraining);
            result.put("tuningJobResourceName", tuningJobResourceName);
            result.put("jobId", jobId);
            result.put("deployedEndpointId", deployedEndpointId);
            result.put("scheduler", schedulerResult);
            result.put("tuningServiceResponse", responseBody);
            result.put("statusCode", response.getStatusCode().value());
            result.put("callbackConfigured", callbackUrl != null && !callbackUrl.isBlank());
            result.put("nextStep", callbackUrl != null && !callbackUrl.isBlank()
                    ? "Auto-tuning triggered. Python service will notify backend when complete. No restart needed."
                    : "Auto-tuning triggered. Monitor job " + jobId + " for completion.");

            lastAutoTriggerResult = result;
            return result;

        } catch (Exception e) {
            log.warn("Error calling UEBA tuning service: {}", e.getMessage());
            Map<String, Object> result = Map.of(
                    "triggered", false,
                    "reason", "TUNING_SERVICE_CALL_FAILED",
                    "gcsUri", gcsUri,
                    "error", e.getMessage()
            );
            lastAutoTriggerResult = result;
            return result;
        }
    }

    // ── Version management ─────────────────────────────────────────────────────

    /**
     * Bump a version string.
     * v0 → v1, v1 → v1.1, v1.1 → v1.2, v9 → v10
     */
    private String bumpVersion(String version) {
        if (version == null || version.isBlank()) return "v1";
        String stripped = version.startsWith("v") ? version.substring(1) : version;
        if (stripped.contains(".")) {
            // patch bump: 1.0 → 1.1
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

    // ── Python state file helpers ──────────────────────────────────────────────

    /**
     * Load the latest succeeded job IDs from the Python service's state file.
     * The Python service writes each succeeded job to tuning-jobs-state.json.
     * Reading it from Java side lets us discover the seed without calling the
     * Python service every time.
     */
    private void loadLatestSucceededFromStateFile() {
        String stateFile = (pythonStateFile != null && !pythonStateFile.isBlank())
                ? pythonStateFile
                : resolveDefaultPythonStateFile();
        if (stateFile == null) return;

        Path path = Path.of(stateFile);
        if (!java.nio.file.Files.exists(path)) {
            log.debug("UEBA Python state file not found at {}, will discover from base model", stateFile);
            return;
        }

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
                    // Extract job ID from resource name
                    String jobId = resourceName.contains("/")
                            ? resourceName.substring(resourceName.lastIndexOf('/') + 1)
                            : resourceName;
                    latestSucceededJobIds.put(displayName, jobId);
                    log.info("Loaded UEBA succeeded job: displayName={}, jobId={}", displayName, jobId);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to load UEBA state from {}: {}", stateFile, e.getMessage());
        }
    }

    private String resolveDefaultPythonStateFile() {
        // Try common locations where the Python tuning service state file might be
        String[] candidates = {
                "../tuning-service-python/tuning-jobs-state.json",
                "tuning-service-python/tuning-jobs-state.json",
                "/app/tuning-service-python/tuning-jobs-state.json",
                System.getProperty("user.dir") + "/tuning-service-python/tuning-jobs-state.json"
        };
        for (String c : candidates) {
            if (java.nio.file.Files.exists(Path.of(c))) {
                return c;
            }
        }
        return null;
    }

    /**
     * After a successful trigger, write the job ID into the Python state file
     * so the Python service's own state tracking picks it up for future runs.
     * This mirrors what the Python service does internally.
     */
    private void persistJobToPythonState(String displayName, String jobId) {
        String stateFile = (pythonStateFile != null && !pythonStateFile.isBlank())
                ? pythonStateFile
                : resolveDefaultPythonStateFile();
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

            // Upsert: update existing entry for this displayName or add new
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
                    "projects/" + tuningProjectId + "/locations/" + tuningLocation + "/tuningJobs/" + jobId);
            target.put("state", "JOB_STATE_PENDING");
            target.put("createdAt", Instant.now().toString());

            java.nio.file.Files.writeString(path, objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(root),
                    StandardCharsets.UTF_8);
            log.info("Persisted UEBA job to Python state file: displayName={}, jobId={}", displayName, jobId);
        } catch (Exception e) {
            log.warn("Could not persist job to Python state file {}: {}", stateFile, e.getMessage());
        }
    }

    // ── Cloud Scheduler reconcile job ─────────────────────────────────────────

    /**
     * Create a Cloud Scheduler HTTP job that periodically calls
     *   https://<tuning-service-base>/reconcile/{jobId}
     * to poll for tuning completion and auto-deployment.
     */
    private Map<String, Object> createReconcileSchedulerJob(String jobId, String displayName) {
        if (tuningServiceUrl == null || tuningServiceUrl.isBlank()) {
            log.warn("Cannot create scheduler: tuningServiceUrl not configured");
            return Map.of("success", false, "reason", "TUNING_SERVICE_URL_NOT_CONFIGURED");
        }
        if (schedulerServiceAccountEmail == null || schedulerServiceAccountEmail.isBlank()) {
            log.warn("Cannot create scheduler: service-account-email not configured");
            return Map.of("success", false, "reason", "SERVICE_ACCOUNT_NOT_CONFIGURED");
        }

        String baseUrl = tuningServiceUrl;
        if (baseUrl.endsWith("/start")) {
            baseUrl = baseUrl.substring(0, baseUrl.length() - "/start".length());
        }
        String reconcileUri = baseUrl + "/reconcile/" + jobId;
        // Sanitize display name for Cloud Scheduler job name
        String safeName = "ueba-" + displayName.replaceAll("[^a-zA-Z0-9\\-]", "-").toLowerCase() + "-" + jobId;
        if (safeName.length() > 64) safeName = safeName.substring(0, 64);
        String jobName = safeName;

        log.info("Creating Cloud Scheduler job '{}' for reconcile URI {}", jobName, reconcileUri);

        try {
            ProcessBuilder pb = new ProcessBuilder(
                    "gcloud", "scheduler", "jobs", "create", "http", jobName,
                    "--schedule=" + reconcileCron,
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
                return Map.of(
                        "success", false,
                        "jobName", jobName,
                        "exitCode", exitCode,
                        "output", outputText
                );
            }

            log.info("Cloud Scheduler job '{}' created successfully.", jobName);
            return Map.of(
                    "success", true,
                    "jobName", jobName,
                    "uri", reconcileUri,
                    "schedule", reconcileCron,
                    "timeZone", schedulerTimeZone
            );
        } catch (Exception e) {
            log.warn("Exception creating Cloud Scheduler job: {}", e.getMessage());
            return Map.of(
                    "success", false,
                    "error", e.getMessage()
            );
        }
    }

    /**
     * Export UEBA tuning examples to JSONL and upload to GCS.
     */
    private Map<String, Object> exportAndUploadToGcs() {
        String bucket = (gcsBucket != null) ? gcsBucket.trim().replaceFirst("^gs://", "") : "";
        if (bucket.isBlank()) {
            log.warn("UEBA tuning GCS bucket not configured (llm-ueba.tuning.gcs-bucket)");
            return Map.of(
                    "success", false,
                    "error", "GCS_NOT_CONFIGURED",
                    "message", "Set llm-ueba.tuning.gcs-bucket to enable auto-upload."
            );
        }

        String jsonl = uebaTuningService.exportToJsonl();
        long exampleCount = uebaTuningService.countExamples();
        if (exampleCount == 0) {
            return Map.of(
                    "success", true,
                    "exampleCount", 0L,
                    "message", "No UEBA tuning examples to export; upload skipped."
            );
        }

        String prefix = (objectPrefix != null && !objectPrefix.isBlank()) ? objectPrefix : "tuning/ueba/";
        if (!prefix.endsWith("/")) {
            prefix = prefix + "/";
        }
        String objectName = prefix + "ueba-tuning-dataset-" +
                DateTimeFormatter.ISO_INSTANT.format(Instant.now()).replace(":", "-") + ".jsonl";
        byte[] bytes = jsonl.getBytes(StandardCharsets.UTF_8);

        try {
            Storage storage = StorageOptions.getDefaultInstance().getService();
            BlobId blobId = BlobId.of(bucket, objectName);
            BlobInfo blobInfo = BlobInfo.newBuilder(blobId)
                    .setContentType("application/jsonl")
                    .build();
            storage.create(blobInfo, bytes);
            String gcsUri = "gs://" + bucket + "/" + objectName;
            log.info("Uploaded UEBA tuning dataset to {} ({} examples, {} bytes)", gcsUri, exampleCount, bytes.length);
            return Map.of(
                    "success", true,
                    "gcsUri", gcsUri,
                    "objectName", objectName,
                    "exampleCount", exampleCount,
                    "bytesUploaded", bytes.length
            );
        } catch (Exception e) {
            log.error("Failed to upload UEBA tuning dataset to GCS: {}", e.getMessage());
            return Map.of(
                    "success", false,
                    "error", "UPLOAD_FAILED",
                    "message", e.getMessage(),
                    "exampleCount", exampleCount
            );
        }
    }

    /**
     * Check if GCS is configured.
     */
    public boolean isGcsConfigured() {
        if (gcsBucket == null || gcsBucket.isBlank()) return false;
        String b = gcsBucket.trim().replaceFirst("^gs://", "");
        return !b.isBlank();
    }
}
