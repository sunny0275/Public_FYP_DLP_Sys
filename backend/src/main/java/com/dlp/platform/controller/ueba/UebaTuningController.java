package com.dlp.platform.controller.ueba;

import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.entity.UebaTuningExample;
import com.dlp.platform.repository.UebaTuningExampleRepository;
import com.dlp.platform.service.ueba.UebaTuningAutoService;
import com.dlp.platform.service.ueba.UebaTuningService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;

/**
 * REST API for UEBA Vertex AI tuning management.
 *
 * Endpoints:
 * - GET  /api/admin/ueba-tuning/status       — tuning status, example count, last trigger result
 * - POST /api/admin/ueba-tuning/auto-trigger — manually trigger auto-tuning (if >= 100 examples)
 * - GET  /api/admin/ueba-tuning/examples     — list recent tuning examples
 * - POST /api/admin/ueba-tuning/switch      — manually set the UEBA endpoint ID (after tuning completes)
 */
@Slf4j
@RestController
@RequestMapping("/admin/ueba-tuning")
@RequiredArgsConstructor
public class UebaTuningController {

    private final UebaTuningService uebaTuningService;
    private final UebaTuningAutoService uebaTuningAutoService;
    private final UebaTuningExampleRepository tuningExampleRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * GET /api/admin/ueba-tuning/status
     *
     * Returns:
     * - tuning enabled flag
     * - current example count
     * - minimum examples threshold
     * - last auto-trigger result (if any)
     * - GCS bucket configured
     * - continual-training settings
     * - current / next version labels
     */
    @GetMapping("/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getStatus() {
        long count = uebaTuningService.countExamples();
        long threshold = uebaTuningAutoService.getMinExamplesForAutoTuning();
        Map<String, Object> lastResult = uebaTuningAutoService.getLastAutoTriggerResult();

        Map<String, Object> status = new java.util.LinkedHashMap<>();
        status.put("tuningEnabled", uebaTuningAutoService.isTuningEnabled());
        status.put("exampleCount", count);
        status.put("minExamplesRequired", threshold);
        status.put("readyToTune", count >= threshold);
        status.put("gcsConfigured", uebaTuningAutoService.isGcsConfigured());
        status.put("lastAutoTriggerResult", lastResult);

        return ResponseEntity.ok(ApiResponse.success("UEBA tuning status retrieved", status));
    }

    /**
     * GET /api/admin/ueba-tuning/version
     *
     * Returns the current version label and explains the naming convention
     * (LLM_UEBA_v0, v1, v1.1 …).
     */
    @GetMapping("/version")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getVersion() {
        Map<String, Object> info = Map.of(
                "currentVersion", uebaTuningAutoService.getCurrentVersionLabel(),
                "nextVersion", uebaTuningAutoService.getNextVersionLabel(),
                "namingConvention", "LLM_UEBA_{version} — e.g. LLM_UEBA_v0, LLM_UEBA_v1, LLM_UEBA_v1.1 …",
                "continualTraining", true
        );
        return ResponseEntity.ok(ApiResponse.success("UEBA tuning version info", info));
    }

    /**
     * GET /api/admin/ueba-tuning/auto-toggle
     *
     * Returns the current auto-tuning enabled state.
     */
    @GetMapping("/auto-toggle")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getAutoToggle() {
        Map<String, Object> payload = Map.of("enabled", uebaTuningAutoService.isTuningEnabled());
        return ResponseEntity.ok(ApiResponse.success("UEBA auto-tuning toggle state", payload));
    }

    /**
     * POST /api/admin/ueba-tuning/auto-toggle?enabled=true|false
     *
     * Enables or disables the UEBA auto-tuning pipeline at runtime.
     */
    @PostMapping("/auto-toggle")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> setAutoToggle(
            @RequestParam(value = "enabled", defaultValue = "true") boolean enabled
    ) {
        uebaTuningAutoService.setTuningEnabled(enabled);
        Map<String, Object> payload = Map.of(
                "enabled", uebaTuningAutoService.isTuningEnabled(),
                "message", enabled ? "UEBA auto-tuning ENABLED" : "UEBA auto-tuning DISABLED"
        );
        return ResponseEntity.ok(ApiResponse.success(
                enabled ? "UEBA auto-tuning enabled" : "UEBA auto-tuning disabled", payload));
    }

    /**
     * PUT /api/admin/ueba-tuning/min-examples
     *
     * Sets the minimum number of examples required to trigger UEBA auto-tuning (minimum 100).
     */
    @PutMapping("/min-examples")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> setMinExamples(
            @RequestParam(value = "value", defaultValue = "100") long value
    ) {
        if (value < 100) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("minExamples must be at least 100"));
        }
        uebaTuningAutoService.setMinExamplesForAutoTuning(value);
        Map<String, Object> payload = Map.of(
                "minExamples", uebaTuningAutoService.getMinExamplesForAutoTuning(),
                "message", "Minimum examples threshold updated to " + value
        );
        return ResponseEntity.ok(ApiResponse.success("min-examples threshold updated", payload));
    }

    /**
     * POST /api/admin/ueba-tuning/auto-trigger
     *
     * Manually triggers the auto-tuning pipeline:
     * 1. Export examples to JSONL
     * 2. Upload to GCS
     * 3. Call Python tuning service
     *
     * Returns the tuning job resource name and next steps.
     */
    @PostMapping("/auto-trigger")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> autoTrigger() {
        log.info("Manual UEBA auto-trigger requested");
        Map<String, Object> result = uebaTuningAutoService.autoTriggerIfReady();
        return ResponseEntity.ok(ApiResponse.success("UEBA auto-trigger completed", result));
    }

    /**
     * GET /api/admin/ueba-tuning/examples
     *
     * Returns the most recent tuning examples (up to 'limit', default 50).
     */
    @GetMapping("/examples")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> listExamples(
            @RequestParam(defaultValue = "50") int limit
    ) {
        List<Map<String, Object>> examples = uebaTuningService.listExamples(limit);
        return ResponseEntity.ok(ApiResponse.success("UEBA tuning examples retrieved", examples));
    }

    /**
     * POST /api/admin/ueba-tuning/import
     *
     * Bulk import tuning examples from a JSONL file.
     * Each line should be a Vertex AI tuning format:
     * {"systemInstruction":{...},"contents":[{...},{...}]}
     *
     * @param file JSONL file containing training examples
     * @return Import result with count of imported examples
     */
    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> importExamples(
            @RequestParam("file") MultipartFile file
    ) {
        log.info("UEBA tuning import requested: filename={}, size={}", file.getOriginalFilename(), file.getSize());

        if (file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("File is empty"));
        }

        String filename = file.getOriginalFilename();
        if (filename == null || !filename.endsWith(".jsonl")) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("File must be a .jsonl file"));
        }

        int importedCount = 0;
        int errorCount = 0;
        List<String> errors = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {

            String line;
            int lineNum = 0;

            while ((line = reader.readLine()) != null) {
                lineNum++;
                line = line.trim();
                if (line.isEmpty()) continue;

                try {
                    JsonNode root = objectMapper.readTree(line);

                    // Extract system instruction
                    String systemPrompt = "";
                    JsonNode sysInst = root.path("systemInstruction");
                    if (sysInst.has("parts") && sysInst.path("parts").isArray()
                            && sysInst.path("parts").size() > 0) {
                        systemPrompt = sysInst.path("parts").get(0).path("text").asText("");
                    }

                    // Extract user prompt (event context)
                    String userPrompt = "";
                    JsonNode contents = root.path("contents");
                    if (contents.isArray() && contents.size() > 0) {
                        for (JsonNode msg : contents) {
                            if ("user".equals(msg.path("role").asText())
                                    && msg.has("parts") && msg.path("parts").isArray()
                                    && msg.path("parts").size() > 0) {
                                userPrompt = msg.path("parts").get(0).path("text").asText("");
                                break;
                            }
                        }
                    }

                    // Extract model response (correct analysis)
                    String correctJson = "{}";
                    if (contents.isArray() && contents.size() > 1) {
                        for (JsonNode msg : contents) {
                            if ("model".equals(msg.path("role").asText())
                                    && msg.has("parts") && msg.path("parts").isArray()
                                    && msg.path("parts").size() > 0) {
                                correctJson = msg.path("parts").get(0).path("text").asText();
                                break;
                            }
                        }
                    }

                    // Extract action and category from user prompt
                    String action = extractFromPrompt(userPrompt, "Action:");
                    String category = extractFromPrompt(userPrompt, "Category:");
                    String result = extractFromPrompt(userPrompt, "Result:");
                    String details = extractFromPrompt(userPrompt, "Details:");

                    // Create tuning example
                    UebaTuningExample example = UebaTuningExample.builder()
                            .userId(null) // Bulk import, no specific user
                            .accountId("BULK_IMPORT")
                            .action(action != null ? action : "UNKNOWN")
                            .category(category != null ? category : "UNKNOWN")
                            .result(result != null ? result : "UNKNOWN")
                            .details(details != null ? details : "Imported from JSONL")
                            .eventTimestamp(LocalDateTime.now())
                            .systemPromptSnapshot(systemPrompt)
                            .userPromptSnapshot(userPrompt)
                            .llmResponseSnapshot(correctJson)
                            .correctAnalysisJson(correctJson)
                            .source("bulk_import:" + filename)
                            .build();

                    tuningExampleRepository.save(example);
                    importedCount++;

                } catch (Exception e) {
                    errorCount++;
                    if (errors.size() < 10) {
                        errors.add(String.format("Line %d: %s", lineNum, e.getMessage()));
                    }
                }
            }

        } catch (Exception e) {
            log.error("Failed to import UEBA tuning examples", e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("Failed to parse file: " + e.getMessage()));
        }

        long totalExamples = tuningExampleRepository.count();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("importedCount", importedCount);
        result.put("errorCount", errorCount);
        result.put("totalExamples", totalExamples);
        result.put("errors", errors);

        log.info("UEBA tuning import completed: imported={}, errors={}, total={}",
                importedCount, errorCount, totalExamples);

        return ResponseEntity.ok(ApiResponse.success(
                String.format("Imported %d examples (%d errors)", importedCount, errorCount), result));
    }

    /**
     * DELETE /api/admin/ueba-tuning/examples/{id}
     *
     * Delete a specific UEBA tuning example by ID.
     */
    @DeleteMapping("/examples/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteExample(@PathVariable Long id) {
        boolean deleted = uebaTuningService.deleteExample(id);
        if (deleted) {
            return ResponseEntity.ok(ApiResponse.success("UEBA tuning example deleted", null));
        } else {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error("UEBA tuning example not found: " + id));
        }
    }

    /**
     * DELETE /api/admin/ueba-tuning/examples
     *
     * Clear all UEBA tuning examples. Requires confirm=true.
     */
    @DeleteMapping("/examples")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> clearAllExamples(
            @RequestParam(value = "confirm", defaultValue = "false") boolean confirm
    ) {
        if (!confirm) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("confirm=true is required to clear all tuning samples"));
        }
        Map<String, Object> result = uebaTuningService.clearAllExamples();
        return ResponseEntity.ok(ApiResponse.success("All UEBA tuning examples cleared", result));
    }

    private String extractFromPrompt(String prompt, String field) {
        if (prompt == null || field == null) return null;
        int idx = prompt.indexOf(field);
        if (idx < 0) return null;
        int start = idx + field.length();
        int end = prompt.indexOf('\n', start);
        if (end < 0) end = prompt.length();
        return prompt.substring(start, end).trim();
    }
}
