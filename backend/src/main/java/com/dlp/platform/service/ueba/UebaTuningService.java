package com.dlp.platform.service.ueba;

import com.dlp.platform.entity.UebaTuningExample;
import com.dlp.platform.repository.UebaTuningExampleRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Manages UEBA tuning examples for Vertex AI supervised fine-tuning.
 *
 * Examples are recorded when:
 * - An admin overrides an LLM UEBA decision (admin-corrected)
 * - A rule-based result confirms or corrects the LLM result
 * - A true positive / false positive is manually confirmed
 *
 * Examples are exported as Vertex AI JSONL format:
 * {
 *   "systemInstruction": { "role": "system", "parts": [{ "text": "..." }] },
 *   "contents": [
 *     { "role": "user",   "parts": [{ "text": "event context..." }] },
 *     { "role": "model",  "parts": [{ "text": "{\"isAnomalous\":true,...}" }] }
 *   ]
 * }
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UebaTuningService {

    private final UebaTuningExampleRepository tuningExampleRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String DEFAULT_SYSTEM_PROMPT =
            "You are a security analyst specializing in User and Entity Behavior Analytics (UEBA).\n" +
            "Your task is to analyze security events and determine if they represent TRUE ANOMALIES or just NORMAL BEHAVIORS.\n" +
            "## Common FALSE POSITIVES:\n" +
            "- Screen/window focus, alt-tab, multitasking → NORMAL (category: WINDOW_MANAGEMENT, result: SUCCESS)\n" +
            "- Brief disconnections, VPN reconnections → NORMAL\n" +
            "- First login failure then success → NORMAL (typo correction)\n" +
            "- Normal file access during work hours → NORMAL\n" +
            "## TRUE ANOMALIES:\n" +
            "- Screen recording tools detected (OBS, Bandicam, etc) → SUSPICIOUS (type: SCREEN_RECORDING)\n" +
            "- Screenshot shortcuts pressed while viewing sensitive docs → SUSPICIOUS\n" +
            "- Rapid credential failures from same IP → SUSPICIOUS\n" +
            "- Unusual volume of downloads → SUSPICIOUS\n" +
            "- Off-hours access to sensitive systems → SUSPICIOUS\n" +
            "- Privilege escalation attempts → SUSPICIOUS\n" +
            "- Rapid window switching (potential automated capture) → MEDIUM\n" +
            "- Endpoint tampering (debugger, process tampering) → HIGH severity\n" +
            "## Response Format:\n" +
            "Respond ONLY with a valid JSON:\n" +
            "{\"isAnomalous\":true/false,\"confidence\":0.0-1.0,\"anomalyType\":\"NONE|CREDENTIAL_ATTACK|DATA_EXFILTRATION|PRIVILEGE_ESCALATION|OFF_HOURS|UNAUTHORIZED_ACCESS|BEHAVIORAL_DEVIATION|SCREEN_RECORDING|ENDPOINT_TAMPERING\",\"reason\":\"...\",\"recommendedAction\":\"NONE|WARNING|RESTRICT|ALERT_ADMIN|DISABLE_ACCOUNT\",\"severity\":\"LOW|MEDIUM|HIGH|CRITICAL\"}";

    /**
     * Record a UEBA analysis correction / confirmation example.
     *
     * @param userId       user who triggered the event
     * @param accountId    account identifier
     * @param action       event action
     * @param category     event category
     * @param result       event result (FAILURE/WARNING/etc)
     * @param details      event details
     * @param eventTs      when the event occurred
     * @param systemPrompt the system prompt used for this analysis
     * @param userPrompt   the user prompt (event context)
     * @param llmResponse  the raw LLM response text
     * @param correctJson  the correct/expected analysis result as JSON
     * @param source       how this example was generated
     */
    @Transactional
    public UebaTuningExample recordExample(
            Long userId,
            String accountId,
            String action,
            String category,
            String result,
            String details,
            LocalDateTime eventTs,
            String systemPrompt,
            String userPrompt,
            String llmResponse,
            String correctJson,
            String source
    ) {
        String sysPrompt = (systemPrompt != null && !systemPrompt.isBlank())
                ? systemPrompt : DEFAULT_SYSTEM_PROMPT;

        UebaTuningExample example = UebaTuningExample.builder()
                .userId(userId)
                .accountId(accountId)
                .action(action)
                .category(category)
                .result(result)
                .details(details)
                .eventTimestamp(eventTs)
                .systemPromptSnapshot(sysPrompt)
                .userPromptSnapshot(userPrompt)
                .llmResponseSnapshot(llmResponse)
                .correctAnalysisJson(correctJson)
                .source(source)
                .build();

        example = tuningExampleRepository.save(example);
        log.info("Recorded UEBA tuning example id={}, userId={}, action={}, source={}, anomalyType={}",
                example.getId(), userId, action, source,
                extractAnomalyType(correctJson));
        return example;
    }

    /**
     * Count total tuning examples.
     */
    @Transactional(readOnly = true)
    public long countExamples() {
        return tuningExampleRepository.count();
    }

    /**
     * Export all UEBA tuning examples to Vertex AI JSONL format.
     * Each line is one training example for supervised fine-tuning.
     */
    @Transactional(readOnly = true)
    public String exportToJsonl() {
        List<UebaTuningExample> examples = tuningExampleRepository.findAllByOrderByCreatedAtAsc();
        StringBuilder sb = new StringBuilder();
        for (UebaTuningExample ex : examples) {
            String line = toVertexJsonlLine(ex);
            if (line != null && !line.isBlank()) {
                sb.append(line).append('\n');
            }
        }
        return sb.toString();
    }

    private String toVertexJsonlLine(UebaTuningExample ex) {
        try {
            String systemText = ex.getSystemPromptSnapshot() != null
                    ? ex.getSystemPromptSnapshot() : DEFAULT_SYSTEM_PROMPT;
            String userText = ex.getUserPromptSnapshot() != null
                    ? ex.getUserPromptSnapshot() : "";
            String modelText = ex.getCorrectAnalysisJson() != null
                    ? ex.getCorrectAnalysisJson() : "{}";

            Map<String, Object> systemInstruction = Map.of(
                    "role", "system",
                    "parts", List.of(Map.of("text", systemText))
            );
            Map<String, Object> userPart = Map.of(
                    "role", "user",
                    "parts", List.of(Map.of("text", userText))
            );
            Map<String, Object> modelPart = Map.of(
                    "role", "model",
                    "parts", List.of(Map.of("text", modelText))
            );

            Map<String, Object> line = Map.of(
                    "systemInstruction", systemInstruction,
                    "contents", List.of(userPart, modelPart)
            );
            return objectMapper.writeValueAsString(line);
        } catch (Exception e) {
            log.warn("Skip UEBA tuning example {}: {}", ex.getId(), e.getMessage());
            return null;
        }
    }

    /**
     * List recent tuning examples (last N).
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> listExamples(int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 500));
        List<UebaTuningExample> all = tuningExampleRepository.findAllByOrderByCreatedAtAsc();
        int from = Math.max(0, all.size() - safeLimit);
        List<UebaTuningExample> sliced = all.subList(from, all.size());

        List<Map<String, Object>> result = new ArrayList<>();
        for (UebaTuningExample ex : sliced) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", ex.getId());
            item.put("userId", ex.getUserId());
            item.put("accountId", ex.getAccountId());
            item.put("action", ex.getAction());
            item.put("category", ex.getCategory());
            item.put("result", ex.getResult());
            item.put("source", ex.getSource());
            item.put("correctAnalysis", ex.getCorrectAnalysisJson());
            item.put("anomalyType", extractAnomalyType(ex.getCorrectAnalysisJson()));
            item.put("createdAt", ex.getCreatedAt());
            result.add(item);
        }
        return result;
    }

    private String extractAnomalyType(String json) {
        if (json == null || json.isBlank()) return "N/A";
        try {
            var node = objectMapper.readTree(json);
            return node.path("anomalyType").asText("N/A");
        } catch (Exception e) {
            return "N/A";
        }
    }

    /**
     * Delete a specific UEBA tuning example by ID.
     */
    @Transactional
    public boolean deleteExample(Long id) {
        if (tuningExampleRepository.existsById(id)) {
            tuningExampleRepository.deleteById(id);
            log.info("Deleted UEBA tuning example id={}", id);
            return true;
        }
        return false;
    }

    /**
     * Clear all UEBA tuning examples.
     */
    @Transactional
    public Map<String, Object> clearAllExamples() {
        long before = tuningExampleRepository.count();
        tuningExampleRepository.deleteAllInBatch();
        long after = tuningExampleRepository.count();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("deletedCount", Math.max(0, before - after));
        result.put("remainingCount", after);
        log.info("Cleared all UEBA tuning examples: deleted={}, remaining={}", before - after, after);
        return result;
    }
}
