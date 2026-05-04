package com.dlp.platform.service.classification;

import com.dlp.platform.dto.classification.CustomTuningSampleRequest;
import com.dlp.platform.dto.document.DocumentMetadata;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Builds a Vertex AI tuning JSONL dataset from bundled sample documents and uploads to GCS.
 * Samples are read from classpath: classification-tuning-seed/samples-manifest.json and *.md files.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class VertexTuningSeedService {

    private static final String SEED_PATH = "classification-tuning-seed/";
    private static final String MANIFEST_FILE = SEED_PATH + "samples-manifest.json";

    private final LLMClassificationService llmClassificationService;
    private final ClassificationTuningService classificationTuningService;
    private final VertexTuningUploadService vertexTuningUploadService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Build JSONL from seed samples and upload to GCS.
     *
     * @return Map with gcsUri, exampleCount, bytesUploaded, or error
     */
    public Map<String, Object> buildSeedJsonlAndUploadToGcs() {
        List<Map<String, String>> manifest;
        try {
            manifest = loadManifest();
        } catch (Exception e) {
            log.error("Failed to load seed manifest: {}", e.getMessage());
            return Map.of(
                    "success", false,
                    "error", "MANIFEST_ERROR",
                    "message", e.getMessage()
            );
        }

        List<String> lines = new ArrayList<>();
        for (Map<String, String> entry : manifest) {
            String file = entry.get("file");
            String expectedLevel = entry.get("expectedLevel");
            if (file == null || expectedLevel == null) continue;
            String text = loadSampleText(file);
            if (text == null) {
                log.warn("Skip seed sample (file not found or empty): {}", file);
                continue;
            }
            String line = buildJsonlLine(file, expectedLevel, text);
            if (line != null) lines.add(line);
        }

        if (lines.isEmpty()) {
            return Map.of(
                    "success", false,
                    "error", "NO_EXAMPLES",
                    "message", "No seed examples could be built. Check manifest and sample files."
            );
        }

        String jsonl = String.join("\n", lines);
        return vertexTuningUploadService.uploadJsonlToGcs(jsonl, "seed-samples", lines.size());
    }

    /**
     * Build JSONL from custom samples (content + expectedLevel) and upload to GCS.
     * Same Vertex AI format as seed; use e.g. docs/llm-test-samples/*.md with a manifest.
     *
     * @param entries list of content + expectedLevel (PUBLIC, INTERNAL, CONFIDENTIAL, STRICTLY_CONFIDENTIAL)
     * @return Map with gcsUri, exampleCount, bytesUploaded, or error
     */
    public Map<String, Object> buildJsonlFromCustomSamplesAndUploadToGcs(List<CustomTuningSampleRequest.SampleEntry> entries) {
        if (entries == null || entries.isEmpty()) {
            return Map.of(
                    "success", false,
                    "error", "NO_SAMPLES",
                    "message", "samples list is empty"
            );
        }
        List<String> lines = new ArrayList<>();
        for (int i = 0; i < entries.size(); i++) {
            CustomTuningSampleRequest.SampleEntry e = entries.get(i);
            String content = e.getContent();
            String expectedLevel = e.getExpectedLevel();
            if (content == null || expectedLevel == null || expectedLevel.isBlank()) {
                log.warn("Skip custom sample index {}: missing content or expectedLevel", i);
                continue;
            }
            String line = buildJsonlLine("custom-" + i + ".md", expectedLevel.trim().toUpperCase(), content);
            if (line != null) lines.add(line);
        }
        if (lines.isEmpty()) {
            return Map.of(
                    "success", false,
                    "error", "NO_EXAMPLES",
                    "message", "No valid examples could be built from the provided samples."
            );
        }
        String jsonl = String.join("\n", lines);
        return vertexTuningUploadService.uploadJsonlToGcs(jsonl, "custom-samples", lines.size());
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, String>> loadManifest() throws Exception {
        try (InputStream is = new ClassPathResource(MANIFEST_FILE).getInputStream()) {
            return objectMapper.readValue(is, List.class);
        }
    }

    private String loadSampleText(String filename) {
        try (InputStream is = new ClassPathResource(SEED_PATH + filename).getInputStream()) {
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }

    private String buildJsonlLine(String filename, String expectedLevel, String documentText) {
        DocumentMetadata metadata = DocumentMetadata.builder()
                .fileName(filename)
                .department("Seed")
                .build();
        Map<String, String> prompts = llmClassificationService.buildPromptsForTuning(
                documentText, null, metadata);
        String systemPrompt = prompts.get("systemPrompt");
        String userPrompt = prompts.get("userPrompt");
        String modelOutput = classificationTuningService.buildCorrectOutputJson(expectedLevel.toUpperCase());

        try {
            Map<String, Object> systemInstruction = Map.of(
                    "role", "system",
                    "parts", List.of(Map.of("text", systemPrompt != null ? systemPrompt : ""))
            );
            Map<String, Object> userContent = Map.of(
                    "role", "user",
                    "parts", List.of(Map.of("text", userPrompt != null ? userPrompt : ""))
            );
            Map<String, Object> modelContent = Map.of(
                    "role", "model",
                    "parts", List.of(Map.of("text", modelOutput))
            );
            Map<String, Object> line = new LinkedHashMap<>();
            line.put("systemInstruction", systemInstruction);
            line.put("contents", List.of(userContent, modelContent));
            return objectMapper.writeValueAsString(line);
        } catch (Exception e) {
            log.warn("Skip seed example {}: {}", filename, e.getMessage());
            return null;
        }
    }
}
