package com.dlp.platform.service.classification;

import com.dlp.platform.entity.ClassificationTuningExample;
import com.dlp.platform.entity.UploadJob;
import com.dlp.platform.repository.ClassificationTuningExampleRepository;
import com.dlp.platform.repository.UploadJobRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Records classification corrections (suggested level wrong, manual level confirmed)
 * and builds Vertex AI supervised fine-tuning dataset (JSONL format).
 * When the LLM suggested level is wrong and the reviewer/user confirms the correct level,
 * the example is stored and can be exported for Gemini tuning.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ClassificationTuningService {

    private final ClassificationTuningExampleRepository tuningExampleRepository;
    private final UploadJobRepository uploadJobRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Record a correction: LLM suggested level was wrong, confirmed correct level is correctLevel.
     * Call this when reviewer approves a level that differs from job.getSuggestedClassification(),
     * or when user resolves upload with a final level that differs from suggested.
     */
    @Transactional
    public ClassificationTuningExample recordCorrection(Long documentId, Long uploadJobId, String correctLevel) {
        UploadJob job = uploadJobRepository.findById(uploadJobId).orElse(null);
        if (job == null || job.getSuggestedClassification() == null) {
            log.warn("Cannot record tuning example: job {} not found or no suggested classification", uploadJobId);
            return null;
        }
        String suggestedLevel = job.getSuggestedClassification().name();
        if (suggestedLevel.equalsIgnoreCase(correctLevel)) {
            log.debug("Suggested and correct level are the same, skip tuning example");
            return null;
        }

        String systemPrompt = job.getSystemPromptSnapshot();
        String userPrompt = job.getUserPromptSnapshot();
        if (systemPrompt == null || userPrompt == null) {
            log.warn("Job {} has no prompt snapshots, storing correction without prompts (export may need reconstruction)", uploadJobId);
        }

        String correctOutputJson = buildCorrectOutputJson(
                correctLevel,
                "Corrected by reviewer; confirmed as ground truth for tuning.",
                "reviewer-confirmed"
        );

        ClassificationTuningExample example = ClassificationTuningExample.builder()
                .documentId(documentId)
                .uploadJobId(uploadJobId)
                .suggestedLevel(suggestedLevel)
                .correctLevel(correctLevel.toUpperCase())
                .systemPromptSnapshot(systemPrompt)
                .userPromptSnapshot(userPrompt)
                .correctOutputJson(correctOutputJson)
                .build();
        example = tuningExampleRepository.save(example);
        log.info("Recorded classification tuning correction {}: document={}, suggested={}, correct={}",
                example.getId(), documentId, suggestedLevel, correctLevel);
        return example;
    }

    /**
     * Record a positive example: LLM suggested level was accepted as-is by user/reviewer.
     * This lets the model also learn from correct accepted cases, not only mistakes.
     */
    @Transactional
    public ClassificationTuningExample recordAcceptedSuggestion(Long documentId, Long uploadJobId, String level) {
        UploadJob job = uploadJobRepository.findById(uploadJobId).orElse(null);
        if (job == null || job.getSuggestedClassification() == null) {
            log.warn("Cannot record positive tuning example: job {} not found or no suggested classification", uploadJobId);
            return null;
        }
        String suggestedLevel = job.getSuggestedClassification().name();

        String systemPrompt = job.getSystemPromptSnapshot();
        String userPrompt = job.getUserPromptSnapshot();
        if (systemPrompt == null || userPrompt == null) {
            log.warn("Job {} has no prompt snapshots, storing positive example without prompts (export may need reconstruction)", uploadJobId);
        }

        String correctOutputJson = buildCorrectOutputJson(
                level,
                "LLM suggested level accepted by user; treated as ground truth for tuning.",
                "suggestion-accepted"
        );

        ClassificationTuningExample example = ClassificationTuningExample.builder()
                .documentId(documentId)
                .uploadJobId(uploadJobId)
                .suggestedLevel(suggestedLevel)
                .correctLevel(level.toUpperCase())
                .systemPromptSnapshot(systemPrompt)
                .userPromptSnapshot(userPrompt)
                .correctOutputJson(correctOutputJson)
                .build();
        example = tuningExampleRepository.save(example);
        log.info("Recorded classification tuning positive example {}: document={}, level={}",
                example.getId(), documentId, level);
        return example;
    }

    /**
     * Build the correct model output JSON in the same format the LLM is instructed to return.
     */
    public String buildCorrectOutputJson(String correctLevel) {
        return buildCorrectOutputJson(
                correctLevel,
                "Corrected by reviewer; confirmed as ground truth for tuning.",
                "reviewer-confirmed"
        );
    }

    /**
     * Build the correct model output JSON with a custom reason and tag.
     */
    public String buildCorrectOutputJson(String correctLevel, String reason, String tag) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("classificationLevel", correctLevel.toUpperCase());
        out.put("confidence", 0.95);
        out.put("reason", reason);
        out.put("suggestedTags", List.of(tag));
        out.put("detectedSensitiveInfo", List.of());
        try {
            return objectMapper.writeValueAsString(out);
        } catch (Exception e) {
            throw new RuntimeException("Failed to build correct output JSON", e);
        }
    }

    /**
     * Export all stored tuning examples to Vertex AI JSONL format.
     * Each line is one example: systemInstruction + contents (user message + model response).
     * Suitable for Gemini supervised fine-tuning (text modality).
     */
    @Transactional(readOnly = true)
    public String exportToJsonl() {
        List<ClassificationTuningExample> examples = tuningExampleRepository.findAllByOrderByCreatedAtAsc();
        return examples.stream()
                .map(this::toVertexJsonlLine)
                .filter(line -> line != null && !line.isBlank())
                .collect(Collectors.joining("\n"));
    }

    /**
     * One Vertex tuning example as a JSON line (no newline inside).
     * Format: {"systemInstruction": {"role": "system", "parts": [{"text": "..."}]}, "contents": [{"role": "user", "parts": [{"text": "..."}]}, {"role": "model", "parts": [{"text": "..."}]}]}
     */
    private String toVertexJsonlLine(ClassificationTuningExample ex) {
        String systemPrompt = ex.getSystemPromptSnapshot() != null ? ex.getSystemPromptSnapshot() : "";
        String userPrompt = ex.getUserPromptSnapshot() != null ? ex.getUserPromptSnapshot() : "";
        String modelOutput = ex.getCorrectOutputJson() != null ? ex.getCorrectOutputJson() : buildCorrectOutputJson(ex.getCorrectLevel());
        try {
            Map<String, Object> systemInstruction = Map.of(
                    "role", "system",
                    "parts", List.of(Map.of("text", systemPrompt))
            );
            Map<String, Object> userContent = Map.of(
                    "role", "user",
                    "parts", List.of(Map.of("text", userPrompt))
            );
            Map<String, Object> modelContent = Map.of(
                    "role", "model",
                    "parts", List.of(Map.of("text", modelOutput))
            );
            Map<String, Object> line = Map.of(
                    "systemInstruction", systemInstruction,
                    "contents", List.of(userContent, modelContent)
            );
            return objectMapper.writeValueAsString(line);
        } catch (Exception e) {
            log.warn("Skip tuning example {}: {}", ex.getId(), e.getMessage());
            return null;
        }
    }

    @Transactional(readOnly = true)
    public long countExamples() {
        return tuningExampleRepository.count();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listExamples(int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 500));
        List<ClassificationTuningExample> all = tuningExampleRepository.findAllByOrderByCreatedAtAsc();
        int from = Math.max(0, all.size() - safeLimit);
        List<ClassificationTuningExample> sliced = all.subList(from, all.size());

        List<Map<String, Object>> result = new ArrayList<>();
        for (ClassificationTuningExample ex : sliced) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", ex.getId());
            item.put("documentId", ex.getDocumentId());
            item.put("uploadJobId", ex.getUploadJobId());
            item.put("suggestedLevel", ex.getSuggestedLevel());
            item.put("correctLevel", ex.getCorrectLevel());
            item.put("createdAt", ex.getCreatedAt());
            item.put("hasSystemPromptSnapshot", ex.getSystemPromptSnapshot() != null && !ex.getSystemPromptSnapshot().isBlank());
            item.put("hasUserPromptSnapshot", ex.getUserPromptSnapshot() != null && !ex.getUserPromptSnapshot().isBlank());
            item.put("hasCorrectOutputJson", ex.getCorrectOutputJson() != null && !ex.getCorrectOutputJson().isBlank());
            result.add(item);
        }
        return result;
    }

    @Transactional
    public Map<String, Object> clearExamples() {
        long before = tuningExampleRepository.count();
        tuningExampleRepository.deleteAllInBatch();
        long after = tuningExampleRepository.count();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("deletedCount", Math.max(0, before - after));
        result.put("remainingCount", after);
        result.put("clearedAt", LocalDateTime.now());
        return result;
    }
}
