package com.dlp.platform.service.classification;

import com.dlp.platform.dto.document.ClassificationResult;
import com.dlp.platform.dto.document.DocumentMetadata;
import com.dlp.platform.dto.document.RuleDetectionResult;
import com.dlp.platform.entity.Document;
import com.google.auth.oauth2.AccessToken;
import com.google.auth.oauth2.GoogleCredentials;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Service for LLM-based document classification using Vertex AI Gemini (OAuth/ADC)
 *
 * Features:
 * - Automatic classification level determination
 * - Tag suggestions based on content
 * - Confidence scoring
 * - Classification reasoning/explanation
 * - Integration with rule-based detection results
 * - Fallback to rule-based classification if LLM unavailable
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class LLMClassificationService {

    @Value("${vertex.project:}")
    private String vertexProject;

    @Value("${vertex.location:us-central1}")
    private String vertexLocation;

    @Value("${vertex.model:gemini-2.5-flash}")
    private String vertexModel;

    @Value("${vertex.endpoint-id:}")
    private String vertexEndpointId;

    @Value("${vertex.api-key:${VERTEX_API_KEY:${API_KEY:}}}")
    private String vertexApiKey;

    @Value("${classification.confidence.threshold:0.7}")
    private double confidenceThreshold;

    @Value("${classification.llm.enabled:true}")
    private boolean llmEnabled;

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate = new RestTemplate();
    private static final Pattern LEVEL_PATTERN = Pattern.compile(
        "\"classificationLevel\"\\s*:\\s*\"([A-Z_ ]*)",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern CONFIDENCE_PATTERN = Pattern.compile(
        "\"confidence\"\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern REASON_PATTERN = Pattern.compile(
        "\"reason\"\\s*:\\s*\"([^\"]*)",
        Pattern.CASE_INSENSITIVE | Pattern.DOTALL
    );

    /**
     * Runtime health snapshot for LLM dependency chain:
     * config -> ADC/token -> Vertex API reachability.
     */
    public Map<String, Object> healthSnapshot() {
        Map<String, Object> data = new LinkedHashMap<>();
        String apiKey = sanitizeApiKey(vertexApiKey);
        boolean endpointMode = isEndpointModeEnabled();
        boolean useApiKeyMode = !endpointMode && apiKey != null && !apiKey.isBlank();
        data.put("llmEnabled", llmEnabled);
        data.put("authMode", endpointMode ? "OAUTH_ADC_ENDPOINT" : (useApiKeyMode ? "API_KEY" : "OAUTH_ADC"));
        data.put("projectConfigured", vertexProject != null && !vertexProject.isBlank());
        data.put("project", vertexProject);
        data.put("location", normalizeVertexLocation());
        data.put("model", vertexModel);
        data.put("endpointId", sanitizeEndpointId(vertexEndpointId));
        data.put("endpointMode", endpointMode);
        data.put("apiKeyConfigured", useApiKeyMode);

        if (!llmEnabled) {
            data.put("status", "DISABLED");
            data.put("tokenOk", false);
            data.put("vertexReachable", false);
            data.put("message", "LLM classification is disabled by configuration");
            return data;
        }

        if ((endpointMode || !useApiKeyMode) && (vertexProject == null || vertexProject.isBlank())) {
            data.put("status", "MISCONFIGURED");
            data.put("tokenOk", false);
            data.put("vertexReachable", false);
            data.put("message", "vertex.project (GOOGLE_CLOUD_PROJECT) is not configured for OAuth mode");
            return data;
        }

        String token = null;
        if (!useApiKeyMode) {
            try {
                token = getAccessToken();
                data.put("tokenOk", true);
                data.put("tokenPreview", token.length() > 12 ? token.substring(0, 12) + "..." : "***");
            } catch (Exception e) {
                data.put("status", "UNHEALTHY");
                data.put("tokenOk", false);
                data.put("vertexReachable", false);
                data.put("message", "Failed to obtain access token");
                data.put("error", e.getMessage());
                return data;
            }
        } else {
            data.put("tokenOk", true);
            data.put("tokenPreview", "N/A(API_KEY mode)");
        }

        try {
            String generateUrl = buildVertexGenerateUrlForHealthCheck(useApiKeyMode, apiKey);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            if (!useApiKeyMode && token != null) {
                headers.setBearerAuth(token);
            }
            Map<String, Object> healthProbeBody = new LinkedHashMap<>();
            healthProbeBody.put("contents", List.of(
                Map.of(
                    "role", "user",
                    "parts", List.of(Map.of("text", "health check"))
                )
            ));
            healthProbeBody.put("generationConfig", Map.of(
                "temperature", 0.0,
                "maxOutputTokens", 1
            ));
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(healthProbeBody, headers);
            ResponseEntity<String> response = restTemplate.exchange(
                generateUrl,
                HttpMethod.POST,
                entity,
                String.class
            );
            data.put("vertexReachable", response.getStatusCode().is2xxSuccessful());
            data.put("vertexHttpStatus", response.getStatusCode().value());
            data.put("status", response.getStatusCode().is2xxSuccessful() ? "HEALTHY" : "UNHEALTHY");
            data.put("message", response.getStatusCode().is2xxSuccessful()
                ? "Token acquired and Vertex model endpoint reachable"
                : "Vertex model endpoint returned non-2xx status");
            return data;
        } catch (Exception e) {
            data.put("status", "UNHEALTHY");
            data.put("vertexReachable", false);
            data.put("message", useApiKeyMode
                ? "API key configured but Vertex endpoint call failed"
                : "Token acquired but Vertex endpoint call failed");
            data.put("error", e.getMessage());
            return data;
        }
    }

    /**
     * Classify document using LLM
     *
     * @param documentText Extracted text content
     * @param ruleResults PII detection results from rule engine
     * @param metadata Document metadata (filename, department, etc.)
     * @return Classification result with level, tags, confidence, reason
     */
    public ClassificationResult classifyDocument(
            String documentText,
            RuleDetectionResult ruleResults,
            DocumentMetadata metadata) {

        log.info("Classifying document: {}", metadata.getFileName());

        try {
            log.info("LLM classification using Vertex AI (project={}, location={}, model={})",
                vertexProject,
                vertexLocation,
                vertexModel
            );

            // Hard guard: if LLM is disabled or Vertex is not configured, treat as an error.
            if (!llmEnabled || vertexProject == null || vertexProject.isBlank()) {
                throw new IllegalStateException(String.format(
                    "LLM classification disabled or Vertex project not configured (llmEnabled=%s, vertexProject='%s')",
                    llmEnabled,
                    vertexProject
                ));
            }
            // Build classification prompt
            String systemPrompt = buildSystemPrompt();
            String userPrompt = buildUserPrompt(documentText, ruleResults, metadata);

            // Call Vertex AI Gemini API (OAuth/ADC)
            String response = callVertexAI(systemPrompt, userPrompt);

            // Parse response JSON
            ClassificationResult result = parseClassificationResponse(response);

            // Validate and adjust result
            result = validateAndAdjustResult(result, ruleResults);
            if (isMismatch(result, metadata)) {
                log.warn("User selection {} differs from LLM result {}, flagging for manual review",
                    metadata.getSelectedClassificationLevel(), result.getClassificationLevel());
                result.setRequiresManualReview(true);
                result.setReason(result.getReason() + " | Requires manual review: user-selected level differs");
            }

            log.info("Document classified as {} with confidence {}",
                result.getClassificationLevel(), result.getConfidence());
            log.debug("Classification detail: reason='{}', tags={}, sensitiveInfo={}",
                result.getReason(),
                result.getSuggestedTags(),
                result.getDetectedSensitiveInfo());

            return result;

        } catch (Exception e) {
            log.error("Error during LLM classification", e);
            // Propagate error to caller so upload job can mark document for manual review instead of silent fallback.
            throw new RuntimeException("LLM classification failed", e);
        }
    }

    /**
     * Build system and user prompts for classification. Exposed for storing in upload job and building tuning dataset.
     */
    public Map<String, String> buildPromptsForTuning(
            String documentText,
            RuleDetectionResult ruleResults,
            DocumentMetadata metadata) {
        return Map.of(
            "systemPrompt", buildSystemPrompt(),
            "userPrompt", buildUserPrompt(documentText, ruleResults, metadata)
        );
    }

    /**
     * Build system prompt for classification
     */
    private String buildSystemPrompt() {
        String definitions = buildLevelDefinitions();
        return """
            You are a document classification expert for an enterprise Data Leakage Prevention (DLP) system.
            Your task is to analyze document content and classify it into one of four classification levels:

            1. PUBLIC: Information that can be freely shared externally
            2. INTERNAL: Information for internal use only, no external sharing
            3. CONFIDENTIAL: Sensitive business information, restricted access
            4. STRICTLY_CONFIDENTIAL: Highly sensitive information (high-risk PII, bank/payment data, trade secrets)

            Classification criteria:
            - STRICTLY_CONFIDENTIAL: Contains high-risk PII (ID/passport/HKID/DOB), bank/payment identifiers (bank accounts, credit cards),
              sensitive financial ledgers, trade secrets, confidential agreements
            - CONFIDENTIAL: Contains business strategies, internal financial data, employee information,
              proprietary business information, contracts
            - INTERNAL: Contains general business information, internal policies, meeting notes,
              non-sensitive operational data
            - PUBLIC: Contains marketing materials, public announcements, published information,
              general company information

            Additionally, suggest relevant tags for the document based on its content (e.g., "finance", "hr", "legal", "marketing").
            Tagging guidelines (important):
            - Always output tags in lowercase kebab-case (example: "pii-detected", "customer-data", "financial-report").
            - If any personal/customer/employee identifiers are present, include "pii-detected".
            - If high-risk identifiers (IDs, credit cards, bank accounts) are present, include "pii-high-risk".
            - If credit card numbers are present, include "pii-credit-card".
            - If bank account identifiers are present, include "pii-bank-account".
            - If finance/accounting content is present (reports/budgets/invoices/statements), include "finance-detected" (and optionally "invoice").
            - If document looks like payroll / salary register / payslips, include "payroll-detected".
            - If document contains customer lists / CRM exports / contact lists, include "customer-data-detected" (and "customer-data").
            - If document looks like a contract / NDA / agreement, include "contracts-detected" (and "legal").
            - Prefer these domain tags when applicable: "hr", "finance", "customer-data", "legal", "invoice", "meeting-minutes".
            - You may add a few extra tags, but keep total tags <= 10.

            Enterprise context (high priority):
            - Employee onboarding / HR forms (ID/passport, address, bank account, salary, emergency contact) => STRICTLY_CONFIDENTIAL
            - Company financial reports (internal P&L, cashflow, management accounts, forecasts, budgets) => CONFIDENTIAL (or STRICTLY_CONFIDENTIAL if includes bank accounts, payments, customer lists, salaries)
            - Customer data (CRM export, contact list, contracts with customer identifiers, account numbers) => STRICTLY_CONFIDENTIAL
            - Contracts / NDA / legal agreements => CONFIDENTIAL (STRICTLY_CONFIDENTIAL if includes personal data or payment/bank details)
            - Invoices / payroll / compensation => STRICTLY_CONFIDENTIAL
            - Public marketing brochures / press releases => PUBLIC

            Decision rules (must follow):
            - If rule-based detections include any highRisk=true items => STRICTLY_CONFIDENTIAL.
            - If document contains employee personal data or customer personal data => STRICTLY_CONFIDENTIAL even if user selected lower.
            - If document is internal finance / strategy but no direct PII => CONFIDENTIAL.
            - If uncertain between INTERNAL vs CONFIDENTIAL, choose CONFIDENTIAL and lower confidence.

            Respond ONLY with a JSON object in this exact format:
            {
              "classificationLevel": "PUBLIC|INTERNAL|CONFIDENTIAL|STRICTLY_CONFIDENTIAL",
              "confidence": 0.0-1.0,
              "reason": "Brief explanation for classification",
              "suggestedTags": ["tag1", "tag2", "tag3"],
              "detectedSensitiveInfo": ["type1", "type2"]
            }
            """
            + "\n\n" + definitions;
    }

    /**
     * Build user prompt with document content and context
     */
    private String buildUserPrompt(
            String documentText,
            RuleDetectionResult ruleResults,
            DocumentMetadata metadata) {

        // Build a compact but information-rich snippet:
        // include head + tail to capture titles and signature/footer fields.
        String text = documentText == null ? "" : documentText;
        String head = text.length() > 2200 ? text.substring(0, 2200) : text;
        String tail = "";
        if (text.length() > 2600) {
            tail = "\n\n--- DOCUMENT TAIL (last 400 chars) ---\n" + text.substring(text.length() - 400);
        }
        String truncatedText = head + tail;

        StringBuilder prompt = new StringBuilder();
        prompt.append("Please classify the following document:\n\n");
        prompt.append("FILENAME: ").append(metadata.getFileName()).append("\n");
        prompt.append("DEPARTMENT: ").append(metadata.getDepartment()).append("\n\n");

        if (metadata.getTemplateType() != null && !metadata.getTemplateType().isBlank()) {
            prompt.append("USER SELECTED TEMPLATE TYPE: ").append(metadata.getTemplateType()).append("\n");
        }
        if (metadata.getTemplateDataJson() != null && !metadata.getTemplateDataJson().isBlank()) {
            prompt.append("USER PROVIDED STRUCTURED FIELDS (JSON):\n");
            prompt.append(metadata.getTemplateDataJson()).append("\n\n");
        }
        if (metadata.getUserDescription() != null && !metadata.getUserDescription().isBlank()) {
            prompt.append("USER DESCRIPTION:\n").append(metadata.getUserDescription()).append("\n\n");
        }

        // Include rule detection results
        if (ruleResults != null && !ruleResults.getDetections().isEmpty()) {
            prompt.append("DETECTED SENSITIVE INFORMATION:\n");
            ruleResults.getDetections().forEach(detection -> {
                prompt.append("- ").append(detection.getType())
                    .append(": ").append(detection.getCount()).append(" occurrence(s)\n");
            });
            prompt.append("\n");
        }

        if (metadata.getSelectedClassificationLevel() != null) {
            prompt.append("USER SELECTED LEVEL: ").append(metadata.getSelectedClassificationLevel()).append("\n");
            prompt.append("If you disagree with the user selection, explain why and flag for manual review.\n\n");
        }

        prompt.append("DOCUMENT CONTENT:\n");
        prompt.append(truncatedText);

        return prompt.toString();
    }

    /**
     * Call Vertex AI Gemini API with retry logic
     */
    private String callVertexAI(String systemPrompt, String userPrompt) throws Exception {
        log.debug("Sending classification request to Vertex AI (model: {})", vertexModel);
        String apiKey = sanitizeApiKey(vertexApiKey);
        boolean endpointMode = isEndpointModeEnabled();
        boolean useApiKeyMode = !endpointMode && apiKey != null && !apiKey.isBlank();
        String url = useApiKeyMode ? buildApiKeyGenerateUrl(apiKey) : buildOauthGenerateUrl();

        // Vertex request format: systemInstruction + contents + generationConfig + safetySettings
        Map<String, Object> systemInstruction = Map.of(
            "role", "system",
            "parts", List.of(Map.of("text", systemPrompt))
        );

        Map<String, Object> userContent = Map.of(
            "role", "user",
            "parts", List.of(Map.of("text", userPrompt))
        );

        Map<String, Object> generationConfig = new HashMap<>();
        // Keep generation highly deterministic for strict JSON outputs.
        generationConfig.put("temperature", 0.0);
        generationConfig.put("topP", 0.1);
        generationConfig.put("topK", 1);
        // Increased from 1024 to 2048 to prevent MAX_TOKENS truncation
        generationConfig.put("maxOutputTokens", 2048);
        // Ask Vertex to return JSON directly when possible.
        generationConfig.put("responseMimeType", "application/json");
        generationConfig.put("responseSchema", buildClassificationResponseSchema());

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("systemInstruction", systemInstruction);
        requestBody.put("contents", List.of(userContent));
        requestBody.put("generationConfig", generationConfig);
        requestBody.put("safetySettings", List.of(
            Map.of("category", "HARM_CATEGORY_HATE_SPEECH", "threshold", "BLOCK_ONLY_HIGH"),
            Map.of("category", "HARM_CATEGORY_HARASSMENT", "threshold", "BLOCK_ONLY_HIGH"),
            Map.of("category", "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold", "BLOCK_ONLY_HIGH")
        ));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (!useApiKeyMode) {
            headers.setBearerAuth(getAccessToken());
        }

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        int maxRetries = 3;
        int retryCount = 0;
        Exception lastException = null;

        while (retryCount < maxRetries) {
            try {
                ResponseEntity<String> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    String.class
                );

                int statusCode = response.getStatusCode().value();

                // Handle 429 Rate Limit - retry with exponential backoff
                if (statusCode == 429) {
                    lastException = new IOException("Vertex AI rate limit (429). Retrying...");
                    retryCount++;
                    if (retryCount < maxRetries) {
                        // Check for Retry-After header, default to exponential backoff
                        String retryAfter = response.getHeaders().getFirst("Retry-After");
                        long waitMs = retryAfter != null ? 
                            Math.min(Long.parseLong(retryAfter) * 1000, 30000) : // Cap at 30s
                            Math.min(1000L * retryCount * retryCount, 30000); // Exponential, max 30s
                        log.warn("Vertex AI rate limited (429), waiting {}ms before retry ({}/{})", waitMs, retryCount, maxRetries);
                        Thread.sleep(waitMs);
                        continue;
                    }
                    break;
                }

                if (statusCode == 200 && response.getBody() != null) {
                    JsonNode root = objectMapper.readTree(response.getBody());
                    
                    // Log raw response for debugging
                    log.debug("Vertex raw response: {}", response.getBody());
                    
                    // Check for error in response
                    JsonNode error = root.path("error");
                    if (!error.isEmpty()) {
                        log.error("Vertex API error: {}", error.toString());
                        throw new IOException("Vertex API error: " + error.path("message").asText("Unknown error"));
                    }
                    
                    JsonNode candidates = root.path("candidates");
                    if (candidates.isEmpty() || candidates.path(0).isEmpty()) {
                        log.error("Vertex response has no candidates. Response: {}", response.getBody());
                        throw new IOException("Vertex response contains no candidates");
                    }
                    
                    JsonNode candidate = candidates.path(0);
                    String finishReason = candidate.path("finishReason").asText("");
                    if (!finishReason.isBlank()) {
                        log.debug("Vertex finishReason: {}", finishReason);
                    }
                    
                    // Check for content block (function call or text)
                    JsonNode contentNode = candidate.path("content");
                    if (contentNode.isEmpty()) {
                        // Check if there's a finishMessage instead
                        JsonNode finishMessage = candidate.path("finishMessage");
                        if (!finishMessage.isEmpty()) {
                            log.warn("Vertex response has finishMessage instead of content: {}", finishMessage.toString());
                        }
                        log.error("Vertex response has no content in candidate. Full response: {}", response.getBody());
                        throw new IOException("Vertex response contains no content in candidate");
                    }
                    
                    JsonNode parts = contentNode.path("parts");
                    StringBuilder contentBuilder = new StringBuilder();
                    if (parts.isArray()) {
                        for (JsonNode part : parts) {
                            String text = part.path("text").asText("");
                            if (!text.isBlank()) {
                                contentBuilder.append(text);
                            }
                        }
                    }
                    String content = contentBuilder.toString().trim();
                    if (content.isBlank()) {
                        log.error("Vertex response parts contain no text. Parts: {}", parts.toString());
                        throw new IOException("Vertex response contains no text content in candidate parts");
                    }
                    if (!content.isBlank()) {
                        boolean likelyCompleteJson = isLikelyCompleteJson(content);
                        if ("MAX_TOKENS".equalsIgnoreCase(finishReason)) {
                            // Try one compact repair call first to avoid relying on tolerant parse.
                            String repaired = tryRepairPartialJson(content, url, headers);
                            if (repaired != null && isLikelyCompleteJson(repaired)) {
                                log.warn("Recovered full JSON via repair call after MAX_TOKENS");
                                return repaired;
                            }
                            // If repair fails but content is still classifiable, continue with tolerant parse fallback.
                            if (looksClassifiable(content)) {
                                log.warn("Vertex response reached MAX_TOKENS; returning partial content for tolerant parse recovery");
                                return content;
                            }
                            throw new IOException("Vertex response truncated: finishReason=MAX_TOKENS");
                        }
                        if (!likelyCompleteJson && looksClassifiable(content)) {
                            String repaired = tryRepairPartialJson(content, url, headers);
                            if (repaired != null && isLikelyCompleteJson(repaired)) {
                                log.warn("Recovered full JSON via repair call after partial response");
                                return repaired;
                            }
                            log.warn("Vertex response is partial JSON; returning content for tolerant parse recovery");
                            return content;
                        }
                        if (!likelyCompleteJson) {
                            throw new IOException("Vertex response appears to be incomplete JSON");
                        }
                        log.debug("Received classification response from Vertex AI (parts={}, chars={})",
                            parts.isArray() ? parts.size() : 0, content.length());
                        return content;
                    }
                    throw new IOException("Vertex response contains no text content in candidate parts");
                }
            } catch (Exception e) {
                lastException = e;
                retryCount++;
                if (retryCount < maxRetries) {
                    log.warn("Vertex AI call failed, retrying ({}/{}): {}", retryCount, maxRetries, e.getMessage());
                    Thread.sleep(1000L * retryCount);
                }
            }
        }

        throw new Exception("Vertex AI call failed after " + maxRetries + " retries", lastException);
    }

    private String tryRepairPartialJson(String partialContent, String url, HttpHeaders baseHeaders) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.putAll(baseHeaders);
            headers.setContentType(MediaType.APPLICATION_JSON);

            String repairPrompt = """
                Fix this partial JSON into a complete valid JSON object.
                Requirements:
                - Output JSON only, no markdown.
                - Keys required: classificationLevel, confidence, reason, suggestedTags, detectedSensitiveInfo.
                - classificationLevel must be one of PUBLIC, INTERNAL, CONFIDENTIAL, STRICTLY_CONFIDENTIAL.
                - Keep reason <= 120 chars.
                - suggestedTags and detectedSensitiveInfo must be arrays.

                Partial JSON:
                """
                + partialContent;

            Map<String, Object> repairBody = new LinkedHashMap<>();
            repairBody.put("contents", List.of(
                Map.of(
                    "role", "user",
                    "parts", List.of(Map.of("text", repairPrompt))
                )
            ));
            repairBody.put("generationConfig", Map.of(
                "temperature", 0.0,
                "topP", 0.1,
                "topK", 1,
                "maxOutputTokens", 220,
                "responseMimeType", "application/json",
                "responseSchema", buildClassificationResponseSchema()
            ));

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(repairBody, headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
            if (response.getStatusCode() != HttpStatus.OK || response.getBody() == null) {
                return null;
            }
            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode candidate = root.path("candidates").path(0);
            JsonNode parts = candidate.path("content").path("parts");
            StringBuilder contentBuilder = new StringBuilder();
            if (parts.isArray()) {
                for (JsonNode part : parts) {
                    String text = part.path("text").asText("");
                    if (!text.isBlank()) {
                        contentBuilder.append(text);
                    }
                }
            }
            String repaired = contentBuilder.toString().trim();
            return repaired.isBlank() ? null : repaired;
        } catch (Exception e) {
            log.debug("Repair call for partial JSON failed: {}", e.getMessage());
            return null;
        }
    }

    private Map<String, Object> buildClassificationResponseSchema() {
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("classificationLevel", Map.of(
            "type", "string",
            "enum", List.of("PUBLIC", "INTERNAL", "CONFIDENTIAL", "STRICTLY_CONFIDENTIAL")
        ));
        properties.put("confidence", Map.of("type", "number"));
        properties.put("reason", Map.of("type", "string"));
        properties.put("suggestedTags", Map.of(
            "type", "array",
            "items", Map.of("type", "string")
        ));
        properties.put("detectedSensitiveInfo", Map.of(
            "type", "array",
            "items", Map.of("type", "string")
        ));
        return Map.of(
            "type", "object",
            "properties", properties,
            "required", List.of("classificationLevel", "confidence", "reason", "suggestedTags", "detectedSensitiveInfo")
        );
    }

    private boolean isLikelyCompleteJson(String text) {
        if (text == null || text.isBlank()) return false;
        String trimmed = text.trim();
        if (!(trimmed.startsWith("{") && trimmed.endsWith("}"))) {
            return false;
        }
        // Lightweight sanity check to ensure core key exists.
        return trimmed.contains("\"classificationLevel\"");
    }

    private boolean looksClassifiable(String text) {
        if (text == null || text.isBlank()) return false;
        String upper = text.toUpperCase(Locale.ROOT);
        if (upper.contains("\"CLASSIFICATIONLEVEL\"")) return true;
        return upper.contains("STRICTLY_CONFIDENTIAL")
            || upper.contains("STRICTLY_")
            || upper.contains("CONFIDENTIAL")
            || upper.contains("INTERNAL")
            || upper.contains("PUBLIC");
    }

    private String getAccessToken() throws IOException {
        try {
            GoogleCredentials adc = GoogleCredentials.getApplicationDefault()
                .createScoped("https://www.googleapis.com/auth/cloud-platform");
            return extractToken(adc, "ADC");
        } catch (Exception adcError) {
            // Fallback for Docker setups where GOOGLE_APPLICATION_CREDENTIALS points to a mounted directory
            // (e.g., /app/sa.json as a folder containing one JSON key file).
            GoogleCredentials fileCredentials = loadCredentialsFromConfiguredPath();
            if (fileCredentials != null) {
                return extractToken(fileCredentials, "service account file fallback");
            }
            throw new IOException("Unable to obtain Google Cloud access token via ADC or service account file fallback", adcError);
        }
    }

    private String extractToken(GoogleCredentials credentials, String sourceLabel) throws IOException {
        credentials.refreshIfExpired();
        AccessToken token = credentials.getAccessToken();
        if (token == null) {
            credentials.refresh();
            token = credentials.getAccessToken();
        }
        if (token == null || token.getTokenValue() == null || token.getTokenValue().isBlank()) {
            throw new IOException("Unable to obtain Google Cloud access token from " + sourceLabel);
        }
        return token.getTokenValue();
    }

    private GoogleCredentials loadCredentialsFromConfiguredPath() {
        String configured = sanitizePath(System.getenv("GOOGLE_APPLICATION_CREDENTIALS"));
        if (configured == null || configured.isBlank()) {
            return null;
        }

        Path configuredPath = Paths.get(configured);
        try {
            if (Files.isRegularFile(configuredPath)) {
                return loadCredentialsFromFile(configuredPath);
            }
            if (Files.isDirectory(configuredPath)) {
                Path jsonInDir = firstJsonFile(configuredPath);
                if (jsonInDir != null) {
                    log.warn("GOOGLE_APPLICATION_CREDENTIALS points to a directory. Using first JSON key file found: {}", jsonInDir);
                    return loadCredentialsFromFile(jsonInDir);
                }
            }
        } catch (Exception e) {
            log.warn("Failed loading service account credentials from configured path {}: {}", configuredPath, e.getMessage());
        }
        return null;
    }

    private GoogleCredentials loadCredentialsFromFile(Path path) throws IOException {
        try (InputStream in = Files.newInputStream(path)) {
            return GoogleCredentials.fromStream(in)
                .createScoped("https://www.googleapis.com/auth/cloud-platform");
        }
    }

    private Path firstJsonFile(Path directory) throws IOException {
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(directory, "*.json")) {
            for (Path p : stream) {
                if (Files.isRegularFile(p)) return p;
            }
        }
        return null;
    }

    private String sanitizePath(String raw) {
        if (raw == null) return null;
        String trimmed = raw.trim();
        if ((trimmed.startsWith("\"") && trimmed.endsWith("\""))
                || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
            return trimmed.substring(1, trimmed.length() - 1).trim();
        }
        return trimmed;
    }

    private String normalizeVertexLocation() {
        String location = (vertexLocation == null || vertexLocation.isBlank()) ? "us-central1" : vertexLocation.trim();
        if ("global".equalsIgnoreCase(location)) {
            return "us-central1";
        }
        return location;
    }

    private String sanitizeEndpointId(String raw) {
        if (raw == null) return "";
        return raw.trim();
    }

    private boolean isEndpointModeEnabled() {
        return !sanitizeEndpointId(vertexEndpointId).isBlank();
    }

    private String buildOauthGenerateUrl() {
        if (isEndpointModeEnabled()) {
            return buildEndpointGenerateUrl();
        }
        String location = normalizeVertexLocation();
        return String.format(
            "https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/%s:generateContent",
            location,
            vertexProject,
            location,
            vertexModel
        );
    }

    private String buildApiKeyGenerateUrl(String apiKey) {
        return String.format(
            "https://aiplatform.googleapis.com/v1/publishers/google/models/%s:generateContent?key=%s",
            vertexModel,
            apiKey
        );
    }

    private String buildEndpointGenerateUrl() {
        String location = normalizeVertexLocation();
        String endpointId = sanitizeEndpointId(vertexEndpointId);
        return String.format(
            "https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/endpoints/%s:generateContent",
            location,
            vertexProject,
            location,
            endpointId
        );
    }

    private String buildVertexGenerateUrlForHealthCheck(boolean useApiKeyMode, String apiKey) {
        if (useApiKeyMode) {
            return buildApiKeyGenerateUrl(apiKey);
        }
        return buildOauthGenerateUrl();
    }

    private String sanitizeApiKey(String raw) {
        if (raw == null) return null;
        String trimmed = raw.trim();
        if ((trimmed.startsWith("\"") && trimmed.endsWith("\""))
                || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
            return trimmed.substring(1, trimmed.length() - 1).trim();
        }
        return trimmed;
    }

    /**
     * Parse classification response JSON
     */
    private ClassificationResult parseClassificationResponse(String response) {
        try {
            // Extract JSON from response (handle markdown code blocks)
            String jsonContent = response;
            if (response.contains("```json")) {
                jsonContent = response.substring(
                    response.indexOf("```json") + 7,
                    response.lastIndexOf("```")
                ).trim();
            } else if (response.contains("```")) {
                jsonContent = response.substring(
                    response.indexOf("```") + 3,
                    response.lastIndexOf("```")
                ).trim();
            }

            // Parse JSON
            JsonNode root = objectMapper.readTree(jsonContent);

            return parseResultFromJsonNode(root);

        } catch (Exception e) {
            // Tolerant fallback for truncated/partial model output:
            // e.g. {"classificationLevel":"STRICTLY_
            log.warn("Primary JSON parse failed, trying tolerant extraction: {}", e.getMessage());
            ClassificationResult tolerant = parseResultFromMalformedResponse(response);
            if (tolerant != null) {
                return tolerant;
            }
            log.error("Failed to parse classification response", e);
            throw new RuntimeException("Invalid LLM response format", e);
        }
    }

    private ClassificationResult parseResultFromJsonNode(JsonNode root) {
        String levelStr = root.path("classificationLevel").asText();
        Document.ClassificationLevel level = parseClassificationLevel(levelStr);

        ClassificationResult result = ClassificationResult.builder()
            .classificationLevel(level)
            .confidence(root.path("confidence").asDouble(0.5))
            .reason(root.path("reason").asText(""))
            .build();

        JsonNode tagsNode = root.path("suggestedTags");
        if (tagsNode.isArray()) {
            List<String> tags = new ArrayList<>();
            tagsNode.forEach(tag -> tags.add(tag.asText()));
            result.setSuggestedTags(tags);
        }

        JsonNode sensitiveNode = root.path("detectedSensitiveInfo");
        if (sensitiveNode.isArray()) {
            List<String> sensitive = new ArrayList<>();
            sensitiveNode.forEach(info -> sensitive.add(info.asText()));
            result.setDetectedSensitiveInfo(sensitive);
        }
        return result;
    }

    private ClassificationResult parseResultFromMalformedResponse(String rawResponse) {
        if (rawResponse == null || rawResponse.isBlank()) {
            return null;
        }
        String response = rawResponse.trim();
        String jsonLike = response;
        if (response.contains("```json")) {
            int start = response.indexOf("```json") + 7;
            int end = response.indexOf("```", start);
            jsonLike = end > start ? response.substring(start, end).trim() : response.substring(start).trim();
        } else if (response.contains("```")) {
            int start = response.indexOf("```") + 3;
            int end = response.indexOf("```", start);
            jsonLike = end > start ? response.substring(start, end).trim() : response.substring(start).trim();
        }

        String extractedLevel = extractLevelValue(jsonLike);
        if (extractedLevel == null || extractedLevel.isBlank()) {
            return null;
        }
        Document.ClassificationLevel level = parseClassificationLevel(extractedLevel);

        double confidence = 0.5;
        Matcher confidenceMatcher = CONFIDENCE_PATTERN.matcher(jsonLike);
        if (confidenceMatcher.find()) {
            try {
                confidence = Double.parseDouble(confidenceMatcher.group(1));
            } catch (Exception ignored) {
                confidence = 0.5;
            }
        }

        String reason = "";
        Matcher reasonMatcher = REASON_PATTERN.matcher(jsonLike);
        if (reasonMatcher.find()) {
            reason = reasonMatcher.group(1).trim();
        }
        if (reason.isBlank()) {
            reason = "Recovered from partial LLM JSON response";
        }

        ClassificationResult result = ClassificationResult.builder()
            .classificationLevel(level)
            .confidence(confidence)
            .reason(reason)
            .build();

        log.warn("Recovered classification from partial LLM response: level={}, confidence={}", level, confidence);
        return result;
    }

    private String extractLevelValue(String jsonLike) {
        Matcher matcher = LEVEL_PATTERN.matcher(jsonLike);
        if (matcher.find()) {
            String raw = matcher.group(1);
            if (raw != null && !raw.isBlank()) {
                return raw.trim();
            }
        }
        String upper = jsonLike.toUpperCase(Locale.ROOT);
        if (upper.contains("STRICTLY_CONFIDENTIAL") || upper.contains("STRICTLY_")) {
            return "STRICTLY_CONFIDENTIAL";
        }
        if (upper.contains("CONFIDENTIAL")) {
            return "CONFIDENTIAL";
        }
        if (upper.contains("INTERNAL")) {
            return "INTERNAL";
        }
        if (upper.contains("PUBLIC")) {
            return "PUBLIC";
        }
        return null;
    }

    /**
     * Parse classification level string to enum
     */
    private Document.ClassificationLevel parseClassificationLevel(String levelStr) {
        if (levelStr == null || levelStr.isEmpty()) {
            return Document.ClassificationLevel.INTERNAL;
        }

        // Normalize string (remove underscores, convert to uppercase)
        String normalized = levelStr.toUpperCase().replace(" ", "_");
        if ("STRICTLY_".equals(normalized) || "STRICTLY".equals(normalized)) {
            normalized = "STRICTLY_CONFIDENTIAL";
        } else if ("CONF".equals(normalized)) {
            normalized = "CONFIDENTIAL";
        }

        try {
            return Document.ClassificationLevel.valueOf(normalized);
        } catch (IllegalArgumentException e) {
            log.warn("Unknown classification level: {}, defaulting to INTERNAL", levelStr);
            return Document.ClassificationLevel.INTERNAL;
        }
    }

    /**
     * Validate and adjust classification result
     */
    private ClassificationResult validateAndAdjustResult(
            ClassificationResult result,
            RuleDetectionResult ruleResults) {

        // Normalize / ensure tag list exists
        if (result.getSuggestedTags() == null) {
            result.setSuggestedTags(new ArrayList<>());
        }

        // If rule engine detected high-risk PII, force STRICTLY_CONFIDENTIAL
        if (ruleResults != null && ruleResults.hasHighRiskDetections()) {
            if (result.getClassificationLevel() != Document.ClassificationLevel.STRICTLY_CONFIDENTIAL) {
                log.warn("Overriding classification to STRICTLY_CONFIDENTIAL due to high-risk detections");
                result.setClassificationLevel(Document.ClassificationLevel.STRICTLY_CONFIDENTIAL);
                result.setConfidence(0.95); // High confidence when rule-based
                result.setReason("Overridden: High-risk PII detected by rule engine");
            }
        }

        // Auto-tags based on rule detections (helps UI & filtering)
        // We keep these deterministic so tags are consistent across runs.
        if (ruleResults != null && ruleResults.getDetections() != null && !ruleResults.getDetections().isEmpty()) {
            boolean hasPii = false;
            boolean hasFinance = false;
            boolean hasInvoice = false;
            boolean hasHr = false;

            for (RuleDetectionResult.Detection d : ruleResults.getDetections()) {
                if (d == null) continue;
                String type = d.getType() != null ? d.getType().trim() : "";
                if (type.isBlank()) continue;

                switch (type) {
                    // PII types
                    case "SSN":
                    case "CREDIT_CARD":
                    case "CREDIT_CARD_EXPIRY":
                    case "CREDIT_CARD_CVV":
                    case "EMAIL":
                    case "PHONE":
                    case "BANK_ACCOUNT":
                    case "IP_ADDRESS":
                    case "DATE_OF_BIRTH":
                    case "HKID":
                    case "ADDRESS":
                    case "PERSONAL_KEYWORDS":
                        hasPii = true;
                        addTag(result, "pii-" + normalizeTag(type));
                        break;

                    // Finance markers (not necessarily PII)
                    case "FINANCE_KEYWORDS":
                    case "IBAN":
                    case "SWIFT_BIC":
                        hasFinance = true;
                        addTag(result, "finance-" + normalizeTag(type));
                        break;

                    case "INVOICE_KEYWORDS":
                        hasFinance = true;
                        hasInvoice = true;
                        addTag(result, "invoice");
                        break;

                    case "HR_KEYWORDS":
                        hasHr = true;
                        addTag(result, "hr");
                        break;

                    case "PAYROLL_KEYWORDS":
                        hasHr = true;
                        hasFinance = true;
                        addTag(result, "payroll-detected");
                        addTag(result, "hr");
                        addTag(result, "finance-sensitive");
                        break;

                    case "CUSTOMER_DATA_KEYWORDS":
                        hasPii = true; // customer lists usually imply identifiers (even if not detected directly)
                        addTag(result, "customer-data-detected");
                        addTag(result, "customer-data");
                        break;

                    case "CONTRACT_KEYWORDS":
                        addTag(result, "contract-detected");
                        addTag(result, "legal");
                        break;

                    case "CONFIDENTIAL_KEYWORDS":
                        addTag(result, "confidential-marking");
                        break;

                    default:
                        // fallback: keep a normalized tag for traceability
                        addTag(result, normalizeTag(type));
                        break;
                }
            }

            if (hasPii) addTag(result, "pii-detected");
            if (ruleResults.hasHighRiskDetections()) addTag(result, "pii-high-risk");
            if (hasFinance) addTag(result, "finance-detected");
            if (hasInvoice) addTag(result, "finance-sensitive");
            if (hasHr) addTag(result, "hr");
            }

        // Normalize tags (lowercase, kebab-case) and remove empties/duplicates
        if (result.getSuggestedTags() != null && !result.getSuggestedTags().isEmpty()) {
            java.util.LinkedHashSet<String> normalized = new java.util.LinkedHashSet<>();
            for (String t : result.getSuggestedTags()) {
                String nt = normalizeTag(t);
                if (!nt.isBlank()) normalized.add(nt);
            }
            result.setSuggestedTags(new ArrayList<>(normalized));
        }

        // Ensure confidence is within range
        if (result.getConfidence() < 0.0) result.setConfidence(0.0);
        if (result.getConfidence() > 1.0) result.setConfidence(1.0);

        // Limit tags to 10
        if (result.getSuggestedTags().size() > 10) {
            result.setSuggestedTags(result.getSuggestedTags().subList(0, 10));
        }

        // Check if manual review required
        if (result.getConfidence() < confidenceThreshold) {
            result.setRequiresManualReview(true);
        }

        return result;
    }

    private void addTag(ClassificationResult result, String tag) {
        if (result.getSuggestedTags() == null) {
            result.setSuggestedTags(new ArrayList<>());
        }
        result.getSuggestedTags().add(tag);
    }

    private String normalizeTag(String tag) {
        if (tag == null) return "";
        String t = tag.trim().toLowerCase(java.util.Locale.ROOT);
        t = t.replace('_', '-').replace(' ', '-');
        // remove anything not [a-z0-9-]
        t = t.replaceAll("[^a-z0-9\\-]", "");
        // collapse multiple hyphens
        t = t.replaceAll("\\-+", "-");
        // trim hyphens
        t = t.replaceAll("(^-+)|(-+$)", "");
        // cap length for DB/UI sanity
        if (t.length() > 40) t = t.substring(0, 40);
        return t;
    }

    private boolean isMismatch(ClassificationResult result, DocumentMetadata metadata) {
        if (result == null || metadata == null || metadata.getSelectedClassificationLevel() == null) {
            return false;
        }
        return result.getClassificationLevel() != metadata.getSelectedClassificationLevel();
    }

    private String buildLevelDefinitions() {
        return """
            Classification framework definitions:
            - PUBLIC: Marketing collateral, press releases, and information expressly marked as shareable externally.
            - INTERNAL: Operational policies, meeting notes, and general department communication that stay inside the department.
            - CONFIDENTIAL: Contracts, HR records, budgets, and other sensitive business data shared with a small trusted group.
            - STRICTLY_CONFIDENTIAL: High-risk PII, bank/payment identifiers, financial ledgers, trade secrets, security plans and other regulated data requiring executive approval.
            Always explain why a document fits one of these tiers and cite relevant sensitive indicators.
            """;
    }

    /**
     * Fallback classification when LLM fails or is disabled
     */
    private ClassificationResult fallbackClassification(
            RuleDetectionResult ruleResults,
            DocumentMetadata metadata) {

        log.warn("Using fallback classification for document: {}", metadata.getFileName());

        ClassificationResult result = ClassificationResult.builder()
            .classificationLevel(Document.ClassificationLevel.INTERNAL)
            .confidence(0.5)
            .reason("Fallback classification - LLM unavailable")
            .suggestedTags(Arrays.asList("unclassified"))
            .requiresManualReview(true)
            .build();

        // Adjust based on rule results
        if (ruleResults != null && ruleResults.hasDetections()) {
            if (ruleResults.hasHighRiskDetections()) {
                result.setClassificationLevel(Document.ClassificationLevel.STRICTLY_CONFIDENTIAL);
                result.setConfidence(0.8);
                result.setReason("Rule-based classification: High-risk PII detected");

                // Add detected types to tags
                List<String> tags = new ArrayList<>();
                tags.add("pii-detected");
                ruleResults.getDetections().forEach(d -> tags.add(normalizeTag(d.getType())));
                result.setSuggestedTags(tags);
            } else {
                result.setClassificationLevel(Document.ClassificationLevel.CONFIDENTIAL);
                result.setConfidence(0.6);
                result.setReason("Rule-based classification: Sensitive information detected");
            }
        }

        return result;
    }

    /**
     * Check if classification requires manual review
     */
    public boolean requiresManualReview(ClassificationResult result) {
        return result.getConfidence() < confidenceThreshold || result.isRequiresManualReview();
    }
}
