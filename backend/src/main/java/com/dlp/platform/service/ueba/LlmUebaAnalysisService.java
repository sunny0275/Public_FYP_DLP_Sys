package com.dlp.platform.service.ueba;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.auth.oauth2.AccessToken;
import com.google.auth.oauth2.GoogleCredentials;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * LLM-based UEBA Service.
 * Analyzes context to determine if behavior is truly anomalous, reducing false positives.
 * Supports async/sync LLM analysis, context-aware detection, and configurable scoring.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class LlmUebaAnalysisService {

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate = new RestTemplate();
    private final UebaScoreService uebaScoreService;
    private final UebaTuningService uebaTuningService;
    private final org.springframework.context.ApplicationContext applicationContext;
    private final com.dlp.platform.service.audit.AuditService auditService;

    // Cooldown map: composite key (accountId + action) -> last event timestamp (ms)
    private final ConcurrentHashMap<String, Long> screenshotCooldownMap = new ConcurrentHashMap<>();
    private static final long SCREENSHOT_COOLDOWN_MS = 2000; // 2 seconds cooldown for screenshot penalties

    @Value("${llm-ueba.vertex.project:${vertex.project:}}")
    private String vertexProject;

    @Value("${llm-ueba.vertex.location:${vertex.location:us-central1}}")
    private String vertexLocation;

    @Value("${llm-ueba.vertex.model:gemini-2.5-flash}")
    private String vertexModel;

    @Value("${llm-ueba.vertex.endpoint-id:}")
    private String vertexEndpointId;

    @Value("${llm-ueba.vertex.api-key:}")
    private String vertexApiKey;

    @Value("${llm-ueba.enabled:true}")
    private boolean llmUebaEnabled;

    @Value("${llm-ueba.timeout:15000}")
    private int llmTimeout;

    @Value("${llm-ueba.fallback-to-rule-based:true}")
    private boolean fallbackToRuleBased;

    @Value("${llm-ueba.confidence-threshold:0.7}")
    private double confidenceThreshold;

    @Value("${llm-ueba.tuning.min-examples:100}")
    private long minExamplesForTuning;

    /**
     * Analyze a single event asynchronously using LLM.
     */
    @Async
    public CompletableFuture<LlmAnalysisResult> analyzeEventAsync(
            Long userId, String accountId, String action, String category, String result, String details, String ipAddress, LocalDateTime timestamp) {
        return CompletableFuture.supplyAsync(() -> analyzeEvent(userId, accountId, action, category, result, details, ipAddress, timestamp));
    }

    /**
     * Synchronous event analysis - for real-time access decisions.
     */
    public LlmAnalysisResult analyzeEventSync(
            Long userId, String accountId, String action, String category, String result, String details, String ipAddress, LocalDateTime timestamp) {
        return analyzeEvent(userId, accountId, action, category, result, details, ipAddress, timestamp);
    }

    /**
     * Core LLM analysis logic with 4-tier architecture.
     * Tier 1 - Definite Benign: bypass processing
     * Tier 2 - Definite Critical: malware/credential attacks -> DISABLE_ACCOUNT
     * Tier 2.5 - Context-Dependent: off-hours, impossible travel -> rule-based MEDIUM
     * Tier 3 - Definite High: screenshots, data exfiltration -> ALERT_ADMIN
     * Tier 4 - Ambiguous: unknown events -> LLM analysis
     */
    private LlmAnalysisResult analyzeEvent(
            Long userId, String accountId, String action, String category, String result, String details, String ipAddress, LocalDateTime timestamp) {
        // Skip UEBA category to avoid recursion
        if ("UEBA".equalsIgnoreCase(category)) {
            return LlmAnalysisResult.builder()
                    .isAnomalous(false)
                    .confidence(1.0)
                    .reason("UEBA-generated event, skipping analysis")
                    .recommendedAction("NONE")
                    .severity("LOW")
                    .build();
        }

        String upperAction = action != null ? action.toUpperCase() : "";
        String upperCategory = category != null ? category.toUpperCase() : "";
        String upperResult = result != null ? result.toUpperCase() : "";

        // === Tier 1: Definite Benign - No processing needed ===
        LlmAnalysisResult tier1Result = checkDefinitelyBenign(upperAction, upperCategory, upperResult);
        if (tier1Result != null) {
            log.debug("Tier 1 (Definite Benign) matched for action={}", action);
            return tier1Result;
        }

        // === Tier 2: Definite Critical - Immediate account disable ===
        LlmAnalysisResult tier2Result = checkDefiniteCritical(upperAction, upperCategory, upperResult);
        if (tier2Result != null) {
            log.warn("Tier 2 (Definite Critical) matched for action={}, disabling account", action);
            return tier2Result;
        }

        // === Tier 2.5: Context-Dependent - Rule-based (no LLM call) ===
        LlmAnalysisResult tier25Result = checkContextDependent(upperAction, upperCategory, upperResult, ipAddress, timestamp);
        if (tier25Result != null) {
            log.info("Tier 2.5 (Context-Dependent) matched for action={}", action);
            return tier25Result;
        }

        // === Tier 3: Definite High - Immediate alert (no LLM call) ===
        LlmAnalysisResult tier3Result = checkDefiniteHigh(upperAction, upperCategory, upperResult);
        if (tier3Result != null) {
            log.warn("Tier 3 (Definite High) matched for action={}", action);
            return tier3Result;
        }
        
        // === Tier 3.5: Sidecar UEBA Tier 4 - Recording likely, needs LLM confirmation ===
        // These events are tagged by Sidecar as likely recording, but need LLM to confirm
        LlmAnalysisResult tier35Result = checkSidecarUeba4(upperAction, upperDetails);
        if (tier35Result != null) {
            log.info("Tier 3.5 (Sidecar UEBA4) - Recording likely, sending to LLM for confirmation: action={}", action);
            // Pass to LLM for detailed analysis
            return analyzeWithLLM(userId, accountId, action, category, result, details, ipAddress, timestamp);
        }

        // === Tier 4: Ambiguous - Only events that reach here get LLM analysis ===
        log.debug("Tier 4 (Ambiguous) - calling LLM for action={}", action);
        return analyzeWithLLM(userId, accountId, action, category, result, details, ipAddress, timestamp);
    }
    
    private String upperDetails = "";
    
    // ============== Tier 3.5: Sidecar UEBA4 (Recording Likely) ==============
    
    /**
     * Check if event is from Sidecar with UEBA Tier 4 tag.
     * These events have [UEBA_TIER4] prefix and indicate likely recording.
     * They bypass Tier 4 normal LLM check and go directly to specialized analysis.
     */
    private LlmAnalysisResult checkSidecarUeba4(String upperAction, String details) {
        if (details != null && details.contains("[UEBA_TIER4]")) {
            // Extract confidence from details if available
            double confidence = extractConfidenceFromDetails(details);
            
            if (confidence >= 0.9) {
                // Very high confidence - treat as Tier 3
                return createHighResult("High-confidence recording detected from Sidecar: " + upperAction, "HIGH");
            } else if (confidence >= 0.7) {
                // High confidence - immediate alert but track for escalation
                return LlmAnalysisResult.builder()
                        .isAnomalous(true)
                        .confidence(confidence)
                        .anomalyType("RECORDING_LIKELY")
                        .reason("Sidecar UEBA4: Recording likely with " + (confidence * 100) + "% confidence. " + upperAction)
                        .recommendedAction("ALERT_ADMIN")
                        .severity("HIGH")
                        .tierMatched(35)
                        .build();
            } else {
                // Medium confidence - send to LLM for detailed analysis
                return LlmAnalysisResult.builder()
                        .isAnomalous(false) // Don't flag yet, wait for LLM
                        .confidence(confidence)
                        .anomalyType("PENDING_LLM_ANALYSIS")
                        .reason("Sidecar UEBA4: Low confidence (" + (confidence * 100) + "%), LLM analysis required")
                        .recommendedAction("LLM_ANALYSIS")
                        .severity("MEDIUM")
                        .tierMatched(35)
                        .build();
            }
        }
        
        return null; // Not Tier 3.5
    }
    
    /**
     * Extract confidence score from Sidecar event details.
     * Format: "... Confidence: 85%"
     */
    private double extractConfidenceFromDetails(String details) {
        try {
            java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("Confidence:\\s*(\\d+(?:\\.\\d+)?)%?");
            java.util.regex.Matcher match = pattern.matcher(details);
            if (match.find()) {
                return Double.parseDouble(match.group(1)) / 100.0;
            }
        } catch (Exception e) {
            log.debug("Failed to extract confidence from details: {}", e.getMessage());
        }
        return 0.5; // Default 50%
    }

    // ============== Tier 1: Definite Benign ==============
    
    /**
     * Check if event is definitely benign (Tier 1).
     */
    private LlmAnalysisResult checkDefinitelyBenign(String upperAction, String upperCategory, String upperResult) {
        if (isBenignWindowAction(upperAction) && "SUCCESS".equals(upperResult)) {
            return createBenignResult("Window management with success result");
        }
        if (isBenignCategory(upperCategory) && "SUCCESS".equals(upperResult)) {
            return createBenignResult("Benign category with success result");
        }
        
        // Benign category
        if (BENIGN_CATEGORIES.contains(upperCategory)) {
            return createBenignResult("Benign category: " + upperCategory);
        }
        
        return null; // Not Tier 1
    }

    private LlmAnalysisResult createBenignResult(String reason) {
        return LlmAnalysisResult.builder()
                .isAnomalous(false)
                .confidence(1.0)
                .anomalyType("NONE")
                .reason(reason)
                .recommendedAction("NONE")
                .severity("LOW")
                .tierMatched(1)
                .build();
    }

    // ============== Tier 2: Definite Critical ==============
    
    /**
     * Check if event is definite critical (Tier 2).
     * These events trigger immediate account disable.
     */
    private LlmAnalysisResult checkDefiniteCritical(String upperAction, String upperCategory, String upperResult) {
        // Malware detection
        if (upperAction.contains("MALWARE") || upperAction.contains("RANSOMWARE") || 
            upperAction.contains("ROOTKIT") || upperAction.contains("TROJAN")) {
            return createCriticalResult("Malware detected: " + upperAction);
        }
        
        // USB attack (physical data exfiltration)
        if (upperAction.contains("USB_ATTACK") || upperAction.contains("USB_EXFILTRATION") ||
            upperAction.contains("UNAUTHORIZED_USB")) {
            return createCriticalResult("USB attack detected: " + upperAction);
        }
        
        // Credential stuffing / brute force
        if (upperAction.contains("CREDENTIAL_STUFFING") || upperAction.contains("BRUTE_FORCE")) {
            return createCriticalResult("Credential attack detected: " + upperAction);
        }
        
        // Malicious IP detected
        if (upperAction.contains("MALICIOUS_IP") || upperAction.contains("TOR_EXIT_NODE")) {
            return createCriticalResult("Malicious network source: " + upperAction);
        }
        
        // Data exfiltration detected
        if (upperAction.contains("DATA_EXFILTRATION") || upperAction.contains("MASS_DOWNLOAD") ||
            upperAction.contains("BULK_EXPORT_ATTEMPT")) {
            return createCriticalResult("Data exfiltration detected: " + upperAction);
        }
        
        return null; // Not Tier 2
    }

    private LlmAnalysisResult createCriticalResult(String reason) {
        return LlmAnalysisResult.builder()
                .isAnomalous(true)
                .confidence(1.0)
                .anomalyType("CRITICAL_ATTACK")
                .reason(reason)
                .recommendedAction("DISABLE_ACCOUNT")
                .severity("CRITICAL")
                .tierMatched(2)
                .build();
    }

    // ============== Tier 2.5: Context-Dependent ==============
    
    /**
     * Check if event is context-dependent (Tier 2.5).
     * These use rule-based analysis without LLM.
     */
    private LlmAnalysisResult checkContextDependent(String upperAction, String upperCategory, String upperResult,
                                                    String ipAddress, LocalDateTime timestamp) {
        // Off-hours login
        if (isOffHoursEvent(timestamp)) {
            return LlmAnalysisResult.builder()
                    .isAnomalous(true)
                    .confidence(0.75)
                    .anomalyType("OFF_HOURS")
                    .reason("Off-hours activity detected")
                    .recommendedAction("WARNING")
                    .severity("MEDIUM")
                    .tierMatched(25)
                    .build();
        }
        
        // Suspicious authentication events
        if (isSuspiciousAuthEvent(upperAction, upperResult)) {
            String anomalyType = determineSuspiciousAuthType(upperAction);
            return LlmAnalysisResult.builder()
                    .isAnomalous(true)
                    .confidence(0.7)
                    .anomalyType(anomalyType)
                    .reason("Suspicious authentication: " + upperAction)
                    .recommendedAction("WARNING")
                    .severity("MEDIUM")
                    .tierMatched(25)
                    .build();
        }
        
        return null; // Not Tier 2.5
    }

    private boolean isOffHoursEvent(LocalDateTime timestamp) {
        if (timestamp == null) return false;
        int hour = timestamp.getHour();
        int dayOfWeek = timestamp.getDayOfWeek().getValue();
        
        // Off hours: 10pm - 6am or weekends
        boolean isNight = hour >= 22 || hour < 6;
        boolean isWeekend = dayOfWeek == 6 || dayOfWeek == 7;
        
        return isNight || isWeekend;
    }

    private boolean isSuspiciousAuthEvent(String upperAction, String upperResult) {
        return upperAction.contains("IMPOSSIBLE_TRAVEL") ||
               upperAction.contains("UNUSUAL_LOCATION") ||
               upperAction.contains("VPN_DETECTED") ||
               upperAction.contains("MULTIPLE_LOCATION") ||
               upperAction.contains("SESSION_HIJACK");
    }

    private String determineSuspiciousAuthType(String upperAction) {
        if (upperAction.contains("IMPOSSIBLE_TRAVEL")) return "IMPOSSIBLE_TRAVEL";
        if (upperAction.contains("UNUSUAL_LOCATION")) return "UNUSUAL_LOCATION";
        if (upperAction.contains("VPN")) return "VPN_DETECTED";
        return "AUTH_ANOMALY";
    }

    // ============== Tier 3: Definite High ==============
    
    /**
     * Check if event is definite high (Tier 3).
     * These trigger immediate admin alert without LLM.
     */
    private LlmAnalysisResult checkDefiniteHigh(String upperAction, String upperCategory, String upperResult) {
        // Screen recording/capture - HIGH severity regardless of result
        // Tier 3 bypasses LLM for instant response (critical for security events)
        if (SUSPICIOUS_SCREEN_RECORDING_ACTIONS.stream().anyMatch(upperAction::contains)) {
            return createHighResult("Screen capture/recording detected: " + upperAction, 
                                   determineScreenRecordingSeverity(upperAction));
        }
        
        // Screen recording regardless of result
        if (upperAction.contains("SCREEN_RECORDING") || upperAction.contains("SCREEN_CAPTURE")) {
            return createHighResult("Screen recording attempt: " + upperAction, "HIGH");
        }
        
        // USB device detection - HIGH severity (potential data exfiltration via physical device)
        if (upperAction.contains("USB_")) {
            return createHighResult("USB device detected: " + upperAction, "HIGH");
        }
        
        // Suspicious endpoint actions
        if (SUSPICIOUS_ENDPOINT_ACTIONS.stream().anyMatch(upperAction::contains)) {
            return createHighResult("Endpoint tampering: " + upperAction, "HIGH");
        }
        
        // Forced/unauthorized access - Tier 3 immediate alert
        if (upperAction.contains("UNAUTHORIZED_ACCESS")) {
            return createHighResult("Unauthorized access attempt: " + upperAction, "HIGH");
        }
        
        // Suspicious downloads
        if (upperAction.contains("SUSPICIOUS_DOWNLOAD") || upperAction.contains("BULK_DOWNLOAD")) {
            return createHighResult("Suspicious download activity: " + upperAction, "HIGH");
        }
        
        return null; // Not Tier 3
    }

    private LlmAnalysisResult createHighResult(String reason, String severity) {
        return LlmAnalysisResult.builder()
                .isAnomalous(true)
                .confidence(0.9)
                .anomalyType("HIGH_RISK")
                .reason(reason)
                .recommendedAction("ALERT_ADMIN")
                .severity(severity)
                .tierMatched(3)
                .build();
    }

    // ============== Tier 4: LLM Analysis ==============
    
    /**
     * Tier 4: Ambiguous events only reach here.
     * This is the ONLY tier that calls Vertex AI LLM.
     */
    private LlmAnalysisResult analyzeWithLLM(
            Long userId,
            String accountId,
            String action,
            String category,
            String result,
            String details,
            String ipAddress,
            LocalDateTime timestamp
    ) {
        // Skip if LLM UEBA is disabled
        if (!llmUebaEnabled) {
            log.debug("LLM UEBA disabled, using rule-based fallback");
            return createRuleBasedResult(action, category, result);
        }

        try {
            // Build context prompt
            String systemPrompt = buildSystemPrompt();
            String userPrompt = buildUserPrompt(userId, accountId, action, category, result, details, timestamp);

            // Call LLM - THIS IS THE ONLY LLM CALL
            String llmResponse = callVertexAI(systemPrompt, userPrompt);

            // Parse LLM response
            LlmAnalysisResult analysisResult = parseLlmResponse(llmResponse);
            analysisResult.setLlmRawResponse(llmResponse);
            analysisResult.setTierMatched(4);

            // Record this analysis as a tuning example
            recordTuningExample(userId, accountId, action, category, result, details, timestamp,
                    systemPrompt, userPrompt, llmResponse, analysisResult);

            return analysisResult;

        } catch (Exception e) {
            log.error("LLM UEBA analysis failed: {}", e.getMessage(), e);

            // Fallback to conservative Medium-Severity penalty per spec
            if (fallbackToRuleBased) {
                log.warn("Falling back to rule-based analysis for event: {}", action);
                LlmAnalysisResult fallback = createRuleBasedResult(action, category, result);
                fallback.setTierMatched(4);
                return fallback;
            }

            // Conservative fallback per spec: Medium-Severity penalty
            return LlmAnalysisResult.builder()
                    .isAnomalous(true)
                    .confidence(0.0)
                    .reason("LLM analysis failed: " + e.getMessage() + ". Conservative MEDIUM applied.")
                    .recommendedAction("WARNING")
                    .severity("MEDIUM")
                    .tierMatched(4)
                    .build();
        }
    }

    private void recordTuningExample(Long userId, String accountId, String action, String category,
                                     String result, String details, LocalDateTime timestamp,
                                     String systemPrompt, String userPrompt, String llmResponse,
                                     LlmAnalysisResult analysisResult) {
        try {
            String correctJson = objectMapper.writeValueAsString(Map.of(
                    "isAnomalous", analysisResult.isAnomalous(),
                    "confidence", analysisResult.getConfidence(),
                    "anomalyType", analysisResult.getAnomalyType() != null ? analysisResult.getAnomalyType() : "NONE",
                    "reason", analysisResult.getReason() != null ? analysisResult.getReason() : "",
                    "recommendedAction", analysisResult.getRecommendedAction() != null ? analysisResult.getRecommendedAction() : "NONE",
                    "severity", analysisResult.getSeverity() != null ? analysisResult.getSeverity() : "LOW"
            ));
            uebaTuningService.recordExample(
                    userId, accountId, action, category, result, details, timestamp,
                    systemPrompt, userPrompt, llmResponse, correctJson,
                    analysisResult.isAnomalous() ? "true-positive-seed" : "false-positive-seed"
            );
        } catch (Exception tuningEx) {
            log.warn("Failed to record UEBA tuning example (non-fatal): {}", tuningEx.getMessage());
        }
    }

    /**
     * Build system prompt for LLM-based UEBA analysis.
     */
    private String buildSystemPrompt() {
        return """
            You are a security analyst specializing in User and Entity Behavior Analytics (UEBA).
            
            Your task is to analyze security events and determine if they represent TRUE ANOMALIES
            or just NORMAL BEHAVIORS that might superficially look suspicious.
            
            ## Common FALSE POSITIVES to recognize:
            
            1. **Screen/Window Focus Events** (Category: WINDOW_MANAGEMENT):
               - "WINDOW_FOCUS", "WINDOW_BLUR", "SCREEN_SWITCH", "ALT_TAB", "TASK_SWITCH" ??NORMAL when user is multitasking
               - Users regularly switch between applications; this is NOT suspicious
               - Result: SUCCESS ??always BENIGN
            
            2. **Session Events**:
               - Brief disconnections, reconnects within normal hours ??NORMAL
               - Network hiccups, VPN reconnection ??NORMAL
            
            3. **File Access Patterns**:
               - Opening multiple documents in sequence ??NORMAL work behavior
               - Saving files frequently ??NORMAL (auto-save, work patterns)
            
            4. **Authentication Events**:
               - First login attempt failure followed by success ??NORMAL (typo correction)
               - Re-authentication after session timeout ??NORMAL
            
            ## TRUE ANOMALIES to flag:
            
            1. **Screen Recording/Capture** (MOST CRITICAL):
               - "SCREENSHOT_PRESSED", "SCREEN_RECORDING_TOOL_DETECTED" ??HIGH severity, ALWAYS suspicious
               - "SCREENSHOT_TOOL_DETECTED", "HIGH_CPU_BROWSER" ??MEDIUM severity
               - "CLIPBOARD_IMAGE_DETECTED", "RAPID_WINDOW_SWITCHING" ??MEDIUM severity
               - Only flag if user has access to sensitive documents (check context)
            
            2. **Credential Attacks**:
               - Multiple rapid failures from same IP ??SUSPICIOUS
               - Failures followed by success from different IP ??HIGHLY SUSPICIOUS
            
            3. **Data Exfiltration Indicators**:
               - Unusual volume of downloads
               - Access to sensitive files outside normal patterns
               - Bulk export operations
            
            4. **Privilege Escalation**:
               - Access attempts to admin resources from non-admin accounts
               - Unusual API calls or system commands
            
            5. **Endpoint Tampering**:
               - "ENDPOINT_MONITOR_ALERT", "DEBUGGER_ATTACHED", "PROCESS_TAMPERING" ??HIGH severity
               - Suspicious process detection
            
            6. **Off-Hours Activity**:
               - Access from unusual times (unless normal for user)
               - Activities that don't match user's role/department
            
            7. **Behavioral Deviations**:
               - Accessing departments/files outside normal scope
               - Unusual document access patterns (first time ever)
               - Failed access to high-value targets
            
            ## Response Format:
            
            Respond ONLY with a valid JSON object:
            {
              "isAnomalous": true/false,
              "confidence": 0.0-1.0,
              "anomalyType": "NONE|CREDENTIAL_ATTACK|DATA_EXFILTRATION|PRIVILEGE_ESCALATION|OFF_HOURS|UNAUTHORIZED_ACCESS|BEHAVIORAL_DEVIATION|SCREEN_RECORDING|ENDPOINT_TAMPERING",
              "reason": "Brief explanation (max 200 chars)",
              "recommendedAction": "NONE|WARNING|RESTRICT|ALERT_ADMIN|DISABLE_ACCOUNT",
              "severity": "LOW|MEDIUM|HIGH|CRITICAL"
            }
            
            IMPORTANT:
            - WINDOW_MANAGEMENT category with SUCCESS result ??ALWAYS BENIGN
            - Screen recording events ??Consider user context (do they have sensitive docs open?)
            - When in doubt, prefer NORMAL over ANOMALOUS to reduce false positives
            - Consider the FULL CONTEXT including user role, department, time, and history
            - Err on the side of caution: if borderline, set confidence < 0.7
            - Normal multitasking behavior (screen switches, window focus) should NEVER be anomalous
            """;
    }

    /**
     * Build user prompt with event context and user history.
     */
    private String buildUserPrompt(
            Long userId,
            String accountId,
            String action,
            String category,
            String result,
            String details,
            LocalDateTime timestamp
    ) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("Analyze the following security event:\n\n");

        prompt.append("## Current Event\n");
        prompt.append("- User ID: ").append(userId != null ? userId : "N/A").append("\n");
        prompt.append("- Account: ").append(accountId != null ? accountId : "N/A").append("\n");
        prompt.append("- Action: ").append(action != null ? action : "N/A").append("\n");
        prompt.append("- Category: ").append(category != null ? category : "N/A").append("\n");
        prompt.append("- Result: ").append(result != null ? result : "N/A").append("\n");
        prompt.append("- Details: ").append(details != null ? details : "N/A").append("\n");
        prompt.append("- Timestamp: ").append(timestamp != null ? timestamp : LocalDateTime.now()).append("\n");

        // Add time context
        LocalDateTime now = timestamp != null ? timestamp : LocalDateTime.now();
        prompt.append("- Hour of Day: ").append(now.getHour()).append(":00\n");
        prompt.append("- Day of Week: ").append(now.getDayOfWeek()).append("\n");

        // Determine if it's working hours (9am-6pm Mon-Fri)
        boolean isWorkingHours = now.getHour() >= 9 && now.getHour() <= 18
                && now.getDayOfWeek().getValue() >= 1 && now.getDayOfWeek().getValue() <= 5;
        prompt.append("- Is Working Hours: ").append(isWorkingHours).append("\n");

        prompt.append("\n## Classification Guide\n");
        prompt.append("- If action contains 'WINDOW_FOCUS', 'WINDOW_BLUR', 'SCREEN_SWITCH', 'ALT_TAB' ??NORMAL (multitasking)\n");
        prompt.append("- If category is 'WINDOW_MANAGEMENT' and result is 'SUCCESS' ??ALWAYS NORMAL\n");
        prompt.append("- If action contains 'SCREENSHOT', 'SCREEN_RECORDING', 'CLIPBOARD_IMAGE' ??depends on context\n");
        prompt.append("- If action is 'LOGIN_FAILURE' followed by success ??NORMAL (typo)\n");
        prompt.append("- If action is 'UNAUTHORIZED_ACCESS' ??requires context (role, file sensitivity)\n");
        prompt.append("- If action contains 'RAPID_WINDOW_SWITCHING' ??might indicate automated capture\n");

        prompt.append("\n## Your Analysis\n");
        prompt.append("Based on the event details, is this a TRUE ANOMALY or NORMAL behavior?\n");
        prompt.append("Provide your analysis in the required JSON format.\n");

        return prompt.toString();
    }

    /**
     * Call Vertex AI for analysis.
     */
    private String callVertexAI(String systemPrompt, String userPrompt) throws Exception {
        String apiKey = sanitizeApiKey(vertexApiKey);
        boolean endpointMode = isEndpointModeEnabled();
        boolean useApiKeyMode = !endpointMode && apiKey != null && !apiKey.isBlank();
        String url = useApiKeyMode ? buildApiKeyGenerateUrl(apiKey) : buildOauthGenerateUrl();
        
        log.info("UEBA calling Vertex AI: endpointMode={}, useApiKeyMode={}, url={}, model={}", 
            endpointMode, useApiKeyMode, maskUrl(url), vertexModel);
        
        Map<String, Object> systemInstruction = Map.of(
                "role", "system",
                "parts", List.of(Map.of("text", systemPrompt))
        );

        Map<String, Object> userContent = Map.of(
                "role", "user",
                "parts", List.of(Map.of("text", userPrompt))
        );

        Map<String, Object> generationConfig = new HashMap<>();
        generationConfig.put("temperature", 0.0);
        generationConfig.put("topP", 0.1);
        generationConfig.put("topK", 1);
        generationConfig.put("maxOutputTokens", 512);
        generationConfig.put("responseMimeType", "application/json");
        generationConfig.put("responseSchema", buildAnalysisResponseSchema());

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("systemInstruction", systemInstruction);
        requestBody.put("contents", List.of(userContent));
        requestBody.put("generationConfig", generationConfig);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (!useApiKeyMode) {
            headers.setBearerAuth(getAccessToken());
        }

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        int maxRetries = 3; // Increased from 2 to 3 for better resilience
        Exception lastException = null;

        for (int retry = 0; retry < maxRetries; retry++) {
            try {
                ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class, new Object[0]);

                int statusCode = response.getStatusCode().value();

                // Handle 429 Rate Limit - retry with exponential backoff
                if (statusCode == 429) {
                    lastException = new IOException("Vertex AI rate limit (429). Retrying...");
                    if (retry < maxRetries - 1) {
                        String retryAfter = response.getHeaders().getFirst("Retry-After");
                        long waitMs = retryAfter != null ? 
                            Math.min(Long.parseLong(retryAfter) * 1000, 30000) :
                            Math.min(2000L * (retry + 1), 30000);
                        log.warn("UEBA: Vertex AI rate limited (429), waiting {}ms before retry ({}/{})", waitMs, retry + 1, maxRetries);
                        Thread.sleep(waitMs);
                        continue;
                    }
                    break;
                }

                if (statusCode == 200 && response.getBody() != null) {
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
                    return contentBuilder.toString().trim();
                }
            } catch (Exception e) {
                lastException = e;
                if (retry < maxRetries - 1) {
                    Thread.sleep(500L * (retry + 1));
                }
            }
        }

        throw new Exception("Vertex AI call failed after " + maxRetries + " retries", lastException);
    }

    private Map<String, Object> buildAnalysisResponseSchema() {
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("isAnomalous", Map.of("type", "boolean"));
        properties.put("confidence", Map.of("type", "number"));
        properties.put("anomalyType", Map.of(
                "type", "string",
                "enum", List.of("NONE", "CREDENTIAL_ATTACK", "DATA_EXFILTRATION", "PRIVILEGE_ESCALATION",
                        "OFF_HOURS", "UNAUTHORIZED_ACCESS", "BEHAVIORAL_DEVIATION")
        ));
        properties.put("reason", Map.of("type", "string"));
        properties.put("recommendedAction", Map.of(
                "type", "string",
                "enum", List.of("NONE", "WARNING", "RESTRICT", "ALERT_ADMIN", "DISABLE_ACCOUNT")
        ));
        properties.put("severity", Map.of(
                "type", "string",
                "enum", List.of("LOW", "MEDIUM", "HIGH", "CRITICAL")
        ));
        return Map.of(
                "type", "object",
                "properties", properties,
                "required", List.of("isAnomalous", "confidence", "anomalyType", "reason", "recommendedAction", "severity")
        );
    }

    /**
     * Parse LLM response into structured result.
     */
    private LlmAnalysisResult parseLlmResponse(String response) {
        try {
            String jsonContent = extractJson(response);
            JsonNode root = objectMapper.readTree(jsonContent);

            boolean isAnomalous = root.path("isAnomalous").asBoolean(false);
            double confidence = root.path("confidence").asDouble(0.5);
            String anomalyType = root.path("anomalyType").asText("NONE");
            String reason = root.path("reason").asText("No reason provided");
            String recommendedAction = root.path("recommendedAction").asText("NONE");
            String severity = root.path("severity").asText("LOW");

            // Truncate reason if too long
            if (reason.length() > 200) {
                reason = reason.substring(0, 197) + "...";
            }

            return LlmAnalysisResult.builder()
                    .isAnomalous(isAnomalous)
                    .confidence(confidence)
                    .anomalyType(anomalyType)
                    .reason(reason)
                    .recommendedAction(recommendedAction)
                    .severity(severity)
                    .llmRawResponse(response)
                    .build();

        } catch (Exception e) {
            log.error("Failed to parse LLM response: {}", e.getMessage());
            return LlmAnalysisResult.builder()
                    .isAnomalous(false)
                    .confidence(0.0)
                    .reason("Failed to parse LLM response: " + e.getMessage())
                    .recommendedAction("INVESTIGATE")
                    .build();
        }
    }

    /**
     * Extract JSON from response (handles markdown code blocks).
     */
    private String extractJson(String response) {
        if (response == null || response.isBlank()) return "{}";

        String trimmed = response.trim();
        if (trimmed.startsWith("```json")) {
            int start = trimmed.indexOf("```json") + 7;
            int end = trimmed.lastIndexOf("```");
            return end > start ? trimmed.substring(start, end).trim() : trimmed;
        } else if (trimmed.startsWith("```")) {
            int start = trimmed.indexOf("```") + 3;
            int end = trimmed.lastIndexOf("```");
            return end > start ? trimmed.substring(start, end).trim() : trimmed;
        }
        return trimmed;
    }

    // List of benign actions (window management - normal multitasking)
    private static final Set<String> BENIGN_WINDOW_ACTIONS = Set.of(
            "WINDOW_LOST_FOCUS", "WINDOW_BLUR", "WINDOW_FOCUS", "FOCUS_CHANGE",
            "MINIMIZE_WINDOW", "MAXIMIZE_WINDOW", "CLOSE_WINDOW", "RESTORE_WINDOW",
            "ALT_TAB", "SCREEN_SWITCH", "TASK_SWITCH"
    );

    // List of benign categories
    private static final Set<String> BENIGN_CATEGORIES = Set.of(
            "WINDOW_MANAGEMENT"
    );

    // Screen recording actions that are ALWAYS suspicious
    // Tier 3 - Definite High: Screenshots, data exfiltration → ALERT_ADMIN immediately (no LLM call)
    // This tier uses simple rule matching for instant response without LLM latency
    private static final Set<String> SUSPICIOUS_SCREEN_RECORDING_ACTIONS = Set.of(
            // Electron-side detection (legacy)
            "SCREENSHOT_ATTEMPT", "SCREENSHOT_PRESSED", "SCREENSHOT_WIN_SHARP_S",
            "SCREENSHOT_MAC_FULL", "SCREENSHOT_MAC_PARTIAL", "SCREENSHOT_MAC_MENU",
            "SCREENSHOT_TOOL_DETECTED", "SCREEN_RECORDING_TOOL_DETECTED",
            "HIGH_CPU_BROWSER", "RAPID_WINDOW_SWITCHING",
            "CLIPBOARD_IMAGE_DETECTED", "LARGE_CLIPBOARD_COPY",
            "SCREENSHOT_ALT_PRESSED", "GAME_BAR_DETECTED",
            "BROWSER_CAPTURE_EXTENSION",
            // Sidecar native detection (new)
            "SCREENSHOT_HOOK_DETECTED", "WINDOWS_SNIPPING_TOOL", "CTRL_SHIFT_S_SCREENSHOT",
            "SCREENSHOT_KEY_PRESSED", "VIRTUAL_DISPLAY_DETECTED", "CAPTURE_DEVICE_DETECTED",
            "RECORDING_TOOL_BLOCKED", "RECORDING_TOOL_SIGNED", "RECORDING_TOOL_UNSIGNED",
            "PROCESS_TERMINATED", "WORKSTATION_LOCKED",
            "AUDIO_RECORDING_DETECTED", "USB_POLICY_CHANGED",
            // Sidecar UEBA Tier 4 events (Recording Likely)
            "RECORDING_LIKELY", "RECORDING_LIKELY_UEBA4", "RECORDING_CONFIRMED_AUTO_BLOCKED",
            "MONITORED_TOOL_RUNNING"
    );

    // Suspicious endpoint monitoring actions
    private static final Set<String> SUSPICIOUS_ENDPOINT_ACTIONS = Set.of(
            "ENDPOINT_MONITOR_ALERT", "SUSPICIOUS_PROCESS", "DEBUGGER_ATTACHED",
            "PROCESS_TAMPERING", "CONTENT_PROTECTION_BYPASS"
    );

    /**
     * Create rule-based fallback result when LLM is unavailable.
     * Enhanced to handle screen recording and window management events.
     */
    private LlmAnalysisResult createRuleBasedResult(String action, String category, String result) {
        String upperAction = action != null ? action.toUpperCase() : "";
        String upperCategory = category != null ? category.toUpperCase() : "";

        // Rule 1: Normal window management events (SUCCESS) ??BENIGN
        if (isBenignWindowAction(upperAction) || isBenignCategory(upperCategory)) {
            if ("SUCCESS".equalsIgnoreCase(result)) {
                return LlmAnalysisResult.builder()
                        .isAnomalous(false)
                        .confidence(1.0)
                        .anomalyType("NONE")
                        .reason("Rule-based: Normal window management (" + action + ")")
                        .recommendedAction("NONE")
                        .severity("LOW")
                        .build();
            }
        }

        // Rule 2: Screen recording actions ??SUSPICIOUS (always alert)
        if (isSuspiciousScreenRecordingAction(upperAction)) {
            String severity = determineScreenRecordingSeverity(upperAction);
            return LlmAnalysisResult.builder()
                    .isAnomalous(true)
                    .confidence(0.9)
                    .anomalyType("SCREEN_RECORDING")
                    .reason("Rule-based: Screen recording/capture detected (" + action + ")")
                    .recommendedAction("ALERT_ADMIN")
                    .severity(severity)
                    .build();
        }

        // Rule 3: Suspicious endpoint monitoring actions
        if (isSuspiciousEndpointAction(upperAction)) {
            return LlmAnalysisResult.builder()
                    .isAnomalous(true)
                    .confidence(0.85)
                    .anomalyType("ENDPOINT_TAMPERING")
                    .reason("Rule-based: Endpoint tampering detected (" + action + ")")
                    .recommendedAction("ALERT_ADMIN")
                    .severity("HIGH")
                    .build();
        }

        // Rule 4: WARNING result with benign-looking action ??check context
        if ("WARNING".equalsIgnoreCase(result)) {
            // If it's a benign action but WARNING result, still treat as benign
            // (could be informational, not necessarily suspicious)
            if (upperAction.contains("FOCUS") || upperAction.contains("BLUR") ||
                upperAction.contains("WINDOW") || upperAction.contains("SCREEN")) {
                return LlmAnalysisResult.builder()
                        .isAnomalous(false)
                        .confidence(0.8)
                        .anomalyType("NONE")
                        .reason("Rule-based: Benign action with warning flag (" + action + ")")
                        .recommendedAction("NONE")
                        .severity("LOW")
                        .build();
            }
        }

        // Rule 5: FAILURE events ??depends on action type
        if ("FAILURE".equalsIgnoreCase(result)) {
            boolean isSuspicious = !isBenignWindowAction(upperAction);
            return LlmAnalysisResult.builder()
                    .isAnomalous(isSuspicious)
                    .confidence(0.7)
                    .anomalyType(isSuspicious ? "UNAUTHORIZED_ACCESS" : "NONE")
                    .reason("Rule-based: " + (isSuspicious ? "Failure event requires investigation" : "Benign failure event"))
                    .recommendedAction(isSuspicious ? "WARNING" : "NONE")
                    .severity(isSuspicious ? "MEDIUM" : "LOW")
                    .build();
        }

        // Default: treat as informational
        return LlmAnalysisResult.builder()
                .isAnomalous(false)
                .confidence(0.5)
                .anomalyType("NONE")
                .reason("Rule-based: Unknown event type (" + action + ")")
                .recommendedAction("NONE")
                .severity("LOW")
                .build();
    }

    private boolean isBenignWindowAction(String upperAction) {
        return BENIGN_WINDOW_ACTIONS.stream().anyMatch(upperAction::contains);
    }

    private boolean isBenignCategory(String upperCategory) {
        return BENIGN_CATEGORIES.stream().anyMatch(upperCategory::contains);
    }

    private boolean isSuspiciousScreenRecordingAction(String upperAction) {
        return SUSPICIOUS_SCREEN_RECORDING_ACTIONS.stream().anyMatch(upperAction::contains);
    }

    private boolean isSuspiciousEndpointAction(String upperAction) {
        return SUSPICIOUS_ENDPOINT_ACTIONS.stream().anyMatch(upperAction::contains);
    }

    private String determineScreenRecordingSeverity(String upperAction) {
        // High severity: direct screen capture attempts
        if (upperAction.contains("SCREENSHOT_PRESSED") ||
            upperAction.contains("SCREEN_RECORDING_TOOL_DETECTED")) {
            return "HIGH";
        }
        // Medium severity: tool detection, clipboard image
        if (upperAction.contains("SCREENSHOT_TOOL") ||
            upperAction.contains("CLIPBOARD_IMAGE") ||
            upperAction.contains("HIGH_CPU_BROWSER")) {
            return "MEDIUM";
        }
        // Low severity: informational alerts
        return "MEDIUM";
    }

    /**
     * Apply the LLM analysis result to UEBA scoring.
     * Called after async analysis completes.
     */
    public void applyAnalysisResult(
            LlmAnalysisResult result,
            Long userId,
            String accountId,
            String action,
            String details,
            String ipAddress
    ) {
        if (result == null) {
            return;
        }
        
        // Log tier information
        log.info("UEBA analysis [Tier {}] for {}: anomalous={}, confidence={}, action={}, severity={}, reason={}",
                result.getTierMatched(),
                action,
                result.isAnomalous(),
                result.getConfidence(),
                result.getRecommendedAction(),
                result.getSeverity(),
                result.getReason());

        // Tier 1: Benign - no action
        if (result.getTierMatched() == 1 || !result.isAnomalous()) {
            return;
        }

        // Tier 2: Critical - DISABLE_ACCOUNT immediately (no confidence check)
        if ("DISABLE_ACCOUNT".equals(result.getRecommendedAction())) {
            log.error("CRITICAL SECURITY EVENT [Tier 2] - Immediately disabling account: {}", accountId);
            uebaScoreService.disableAccount(userId, accountId, 
                    "Tier2-CRITICAL: " + result.getReason() + " (type=" + result.getAnomalyType() + ")");
            return;
        }

        // Tier 3: Definite High - ALERT_ADMIN immediately (no confidence check)
        if ("ALERT_ADMIN".equals(result.getRecommendedAction())) {
            log.error("HIGH SECURITY ALERT [Tier 3] - Immediate admin alert for action={}, account={}", action, accountId);
            // Log the alert to audit log for admin visibility
            auditService.logUebaAction(userId, accountId, "SECURITY_ALERT",
                    "HIGH", "Tier3-ALERT: " + result.getReason() + " (type=" + result.getAnomalyType() + ")", ipAddress);

            // Cooldown check: only deduct once per (accountId+action) per 2 seconds
            String cooldownKey = accountId + "|" + action;
            long now = System.currentTimeMillis();
            Long lastTime = screenshotCooldownMap.get(cooldownKey);
            if (lastTime != null && (now - lastTime) < SCREENSHOT_COOLDOWN_MS) {
                log.debug("Screenshot penalty cooldown active for {}, skipping deduct (last={}ms ago)",
                        cooldownKey, now - lastTime);
            } else {
                screenshotCooldownMap.put(cooldownKey, now);
                uebaScoreService.deduct(userId, accountId, 15,
                        "Tier3-ALERT: " + result.getReason() + " (type=" + result.getAnomalyType() + ")", ipAddress);
            }
            return;
        }

        // Tiers 2.5, 4: Check confidence threshold
        if (result.getConfidence() < confidenceThreshold) {
            log.debug("Below confidence threshold ({}), not applying penalty", confidenceThreshold);
            return;
        }

        // Determine points to deduct based on severity and confidence
        int pointsToDeduct = calculatePointsToDeduct(result);

        // Apply penalty for WARNING / RESTRICT with cooldown
        switch (result.getRecommendedAction()) {
            case "WARNING":
                if (!isInCooldown(accountId, action)) {
                    uebaScoreService.deductForWarning(userId, accountId,
                            "Tier" + result.getTierMatched() + ": " + result.getReason() + " (type=" + result.getAnomalyType() + ")", ipAddress);
                }
                break;
            case "RESTRICT":
                if (!isInCooldown(accountId, action)) {
                    uebaScoreService.deduct(userId, accountId, pointsToDeduct,
                            "Tier" + result.getTierMatched() + ": " + result.getReason() + " (type=" + result.getAnomalyType() + ")", ipAddress);
                }
                break;
            default:
                log.debug("No action required for recommendedAction: {}", result.getRecommendedAction());
        }
    }

    /**
     * Check if (accountId + action) is in 2-second cooldown.
     * Returns true if called within cooldown window.
     */
    private boolean isInCooldown(String accountId, String action) {
        String cooldownKey = accountId + "|" + action;
        long now = System.currentTimeMillis();
        Long lastTime = screenshotCooldownMap.get(cooldownKey);
        if (lastTime != null && (now - lastTime) < SCREENSHOT_COOLDOWN_MS) {
            log.debug("Cooldown active for {}, skipping deduct (last={}ms ago)", cooldownKey, now - lastTime);
            return true;
        }
        screenshotCooldownMap.put(cooldownKey, now);
        return false;
    }

    /**
     * Calculate points to deduct based on severity and confidence.
     */
    private int calculatePointsToDeduct(LlmAnalysisResult result) {
        int basePoints = switch (result.getSeverity()) {
            case "LOW" -> 5;
            case "MEDIUM" -> 10;
            case "HIGH" -> 15;
            case "CRITICAL" -> 25;
            default -> 10;
        };

        // Scale by confidence (higher confidence = more points)
        double confidenceMultiplier = result.getConfidence();
        return (int) Math.round(basePoints * confidenceMultiplier);
    }

    /**
     * Health check for LLM UEBA service.
     */
    public Map<String, Object> healthCheck() {
        Map<String, Object> health = new LinkedHashMap<>();
        health.put("llmUebaEnabled", llmUebaEnabled);
        health.put("fallbackToRuleBased", fallbackToRuleBased);
        health.put("confidenceThreshold", confidenceThreshold);
        health.put("model", vertexModel);
        health.put("location", normalizeVertexLocation());

        // Tuning info
        boolean hasEndpoint = !sanitizeEndpointId(vertexEndpointId).isBlank();
        health.put("usingTunedEndpoint", hasEndpoint);
        health.put("endpointId", hasEndpoint ? sanitizeEndpointId(vertexEndpointId) : null);
        health.put("tuningExampleCount", uebaTuningService.countExamples());
        health.put("tuningMinExamples", minExamplesForTuning);
        health.put("tuningReady", uebaTuningService.countExamples() >= minExamplesForTuning);

        if (!llmUebaEnabled) {
            health.put("status", "DISABLED");
            return health;
        }

        try {
            // Quick connectivity check
            String apiKey = sanitizeApiKey(vertexApiKey);
            boolean useApiKeyMode = !isEndpointModeEnabled() && apiKey != null && !apiKey.isBlank();

            if (!useApiKeyMode && (vertexProject == null || vertexProject.isBlank())) {
                health.put("status", "MISCONFIGURED");
                health.put("message", "Vertex project not configured");
                return health;
            }

            // Test with a simple prompt
            String testResponse = callVertexAI(
                    "You are a test assistant. Respond with exactly: {\"test\": true}",
                    "Test"
            );

            boolean isHealthy = testResponse != null && testResponse.contains("test");
            health.put("status", isHealthy ? "HEALTHY" : "UNHEALTHY");
            health.put("message", isHealthy
                    ? (hasEndpoint ? "UEBA tuned endpoint operational" : "UEBA base model (gemini-2.5-flash) operational ??ready for tuning at 100 examples")
                    : "LLM returned unexpected response");

        } catch (Exception e) {
            health.put("status", "UNHEALTHY");
            health.put("message", e.getMessage());
        }

        return health;
    }

    // ============ Vertex AI helper methods (copied from LLMClassificationService) ============

    private String getAccessToken() throws IOException {
        try {
            GoogleCredentials adc = GoogleCredentials.getApplicationDefault()
                    .createScoped("https://www.googleapis.com/auth/cloud-platform");
            return extractToken(adc, "ADC");
        } catch (Exception adcError) {
            GoogleCredentials fileCredentials = loadCredentialsFromConfiguredPath();
            if (fileCredentials != null) {
                return extractToken(fileCredentials, "service account file fallback");
            }
            throw new IOException("Unable to obtain Google Cloud access token", adcError);
        }
    }

    private String extractToken(GoogleCredentials credentials, String sourceLabel) throws IOException {
        credentials.refreshIfExpired();
        AccessToken token = credentials.getAccessToken();
        if (token == null || token.getTokenValue() == null || token.getTokenValue().isBlank()) {
            credentials.refresh();
            token = credentials.getAccessToken();
        }
        if (token == null || token.getTokenValue() == null || token.getTokenValue().isBlank()) {
            throw new IOException("Unable to obtain token from " + sourceLabel);
        }
        return token.getTokenValue();
    }

    private GoogleCredentials loadCredentialsFromConfiguredPath() {
        String configured = sanitizePath(System.getenv("GOOGLE_APPLICATION_CREDENTIALS"));
        if (configured == null || configured.isBlank()) return null;

        Path configuredPath = Paths.get(configured);
        try {
            if (Files.isRegularFile(configuredPath)) {
                return loadCredentialsFromFile(configuredPath);
            }
            if (Files.isDirectory(configuredPath)) {
                Path jsonInDir = firstJsonFile(configuredPath);
                if (jsonInDir != null) {
                    log.warn("Using service account from directory: {}", jsonInDir);
                    return loadCredentialsFromFile(jsonInDir);
                }
            }
        } catch (Exception e) {
            log.warn("Failed loading credentials from {}: {}", configuredPath, e.getMessage());
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
        if ("global".equalsIgnoreCase(location)) return "us-central1";
        return location;
    }

    private String sanitizeEndpointId(String raw) {
        return raw != null ? raw.trim() : "";
    }

    private boolean isEndpointModeEnabled() {
        return !sanitizeEndpointId(vertexEndpointId).isBlank();
    }

    private String buildOauthGenerateUrl() {
        if (isEndpointModeEnabled()) {
            return buildEndpointGenerateUrl();
        }
        return String.format(
                "https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/%s:generateContent",
                normalizeVertexLocation(), vertexProject, normalizeVertexLocation(), vertexModel
        );
    }

    private String buildApiKeyGenerateUrl(String apiKey) {
        return String.format(
                "https://aiplatform.googleapis.com/v1/publishers/google/models/%s:generateContent?key=%s",
                vertexModel, apiKey
        );
    }

    private String buildEndpointGenerateUrl() {
        return String.format(
                "https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/endpoints/%s:generateContent",
                normalizeVertexLocation(), vertexProject, normalizeVertexLocation(), sanitizeEndpointId(vertexEndpointId)
        );
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
     * mask url for logging
     */
    private String maskUrl(String url) {
        if (url == null) return "null";
        return url.replaceAll("key=[^&]*", "key=***")
                  .replaceAll("Bearer [^*]+", "Bearer ***");
    }
}
