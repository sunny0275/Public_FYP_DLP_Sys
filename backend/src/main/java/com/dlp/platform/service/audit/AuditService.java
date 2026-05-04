package com.dlp.platform.service.audit;

import com.dlp.platform.entity.AuditLog;
import com.dlp.platform.entity.User;
import com.dlp.platform.repository.AuditLogRepository;
import com.dlp.platform.repository.UserRepository;
import com.dlp.platform.service.BlockchainService;
import com.dlp.platform.service.ueba.LlmAnalysisResult;
import com.dlp.platform.service.ueba.LlmUebaAnalysisService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationContext;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Sort;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;
    private final BlockchainService blockchainService;
    private final org.springframework.context.ApplicationContext applicationContext;
    private static final int WARNING_DEDUCT_POINTS = 10;
    private final Object chainLock = new Object();

    @Value("${dlp.audit.chain.backfill-on-startup:true}")
    private boolean backfillOnStartup;

    /**
     * Log event to immutable audit log with hash chain and optional blockchain anchoring.
     */
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logEvent(
            Long userId,
            String accountId,
            String action,
            String category,
            String result,
            String details,
            String ipAddress,
            String userAgent,
            String deviceFingerprint
    ) {
        try {
            String severity = "LOW";
            if ("DENIED".equalsIgnoreCase(result)) {
                severity = "HIGH";
            } else if ("FAILURE".equalsIgnoreCase(result)) {
                severity = "MEDIUM";
            } else if ("WARNING".equalsIgnoreCase(result)) {
                severity = "LOW";
            }

            AuditLog auditLog = AuditLog.builder()
                    .userId(userId)
                    .accountId(accountId)
                    .action(action)
                    .category(category)
                    .result(result)
                    .details(details)
                    .ipAddress(ipAddress)
                    .userAgent(userAgent)
                    .deviceFingerprint(deviceFingerprint)
                    .severity(severity)
                    .timestamp(LocalDateTime.now())
                    .build();

            AuditLog saved = auditLogRepository.save(auditLog);
            attachImmutableAnchor(saved);
            log.debug("Audit log saved: {} - {} - {} [{}]", category, action, result, severity);

            if ("WARNING".equalsIgnoreCase(result) || "FAILURE".equalsIgnoreCase(result) || "DENIED".equalsIgnoreCase(result)) {
                applyLlmUebaAnalysis(userId, accountId, action, category, result, ipAddress, saved.getTimestamp());
            }
        } catch (Exception e) {
            log.error("Failed to save audit log: {}", e.getMessage(), e);
        }
    }

    /**
     * Attach immutable hash chain anchor to audit log entry.
     * When blockchain is enabled, each entry is also anchored on-chain.
     */
    private void attachImmutableAnchor(AuditLog savedLog) {
        synchronized (chainLock) {
            try {
                String previousHash = resolvePreviousHash(savedLog.getId());
                String currentHash = sha256Hex(buildCanonicalPayload(savedLog, previousHash));
                savedLog.setImmutableHash(currentHash);
                savedLog.setAnchoredAt(LocalDateTime.now());

                if (blockchainService.isEnabled()) {
                    String txHash = blockchainService.anchorSignature(currentHash);
                    savedLog.setBlockchainTxHash(txHash);
                    savedLog.setAnchorStatus(txHash != null && !txHash.isBlank() ? "ANCHORED" : "HASHED");
                } else {
                    savedLog.setAnchorStatus("HASHED");
                }
            } catch (Exception ex) {
                savedLog.setAnchorStatus("ANCHOR_FAILED");
                log.warn("Audit log blockchain anchor failed for id={}: {}", savedLog.getId(), ex.getMessage());
            } finally {
                auditLogRepository.save(savedLog);
            }
        }
    }

    private String buildCanonicalPayload(AuditLog current, String previousHash) {
        return String.join("|",
                "id=" + safe(current.getId()),
                "timestamp=" + safe(current.getTimestamp()),
                "userId=" + safe(current.getUserId()),
                "accountId=" + safe(current.getAccountId()),
                "action=" + safe(current.getAction()),
                "category=" + safe(current.getCategory()),
                "result=" + safe(current.getResult()),
                "details=" + safe(current.getDetails()),
                "ip=" + safe(current.getIpAddress()),
                "ua=" + safe(current.getUserAgent()),
                "device=" + safe(current.getDeviceFingerprint()),
                "prevHash=" + safe(previousHash)
        );
    }

    private String resolvePreviousHash(Long currentId) {
        AuditLog previous = auditLogRepository.findFirstByIdLessThanAndImmutableHashIsNotNullOrderByIdDesc(currentId);
        return previous != null ? safe(previous.getImmutableHash()) : "";
    }

    private String safe(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String sha256Hex(String input) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
        StringBuilder hex = new StringBuilder(hash.length * 2);
        for (byte b : hash) {
            hex.append(String.format("%02x", b));
        }
        return hex.toString();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> verifyChain(boolean verifyOnChain, int maxViolations) {
        int safeMaxViolations = Math.max(1, Math.min(maxViolations, 1000));
        var logs = auditLogRepository.findAll(Sort.by(Sort.Direction.ASC, "id"));

        Map<String, Object> result = new LinkedHashMap<>();
        java.util.List<Map<String, Object>> violations = new java.util.ArrayList<>();
        Map<String, Long> txHashSeenByLogId = new HashMap<>();

        String previousHash = "";
        int checked = 0;
        boolean chainOk = true;

        for (AuditLog logRow : logs) {
            checked++;
            Long logId = logRow.getId();
            String immutableHash = safe(logRow.getImmutableHash());

            if (immutableHash.isBlank()) {
                chainOk = false;
                appendViolation(violations, safeMaxViolations, logId, "MISSING_IMMUTABLE_HASH",
                    "immutableHash is empty");
                previousHash = "";
                continue;
            }

            try {
                String expected = sha256Hex(buildCanonicalPayload(logRow, previousHash));
                if (!expected.equalsIgnoreCase(immutableHash)) {
                    chainOk = false;
                    appendViolation(violations, safeMaxViolations, logId, "HASH_MISMATCH",
                        "expected=" + expected + ", actual=" + immutableHash);
                }
            } catch (Exception e) {
                chainOk = false;
                appendViolation(violations, safeMaxViolations, logId, "HASH_COMPUTE_ERROR", e.getMessage());
            }

            String txHash = safe(logRow.getBlockchainTxHash());
            if (txHash.isBlank()) {
                chainOk = false;
                appendViolation(violations, safeMaxViolations, logId, "MISSING_BLOCKCHAIN_TX",
                    "blockchainTxHash is empty");
            } else {
                Long existing = txHashSeenByLogId.putIfAbsent(txHash.toLowerCase(), logId);
                if (existing != null && !existing.equals(logId)) {
                    chainOk = false;
                    appendViolation(violations, safeMaxViolations, logId, "DUPLICATE_BLOCKCHAIN_TX",
                        "txHash reused by logId=" + existing);
                }
            }

            String anchorStatus = safe(logRow.getAnchorStatus());
            if (!"ANCHORED".equalsIgnoreCase(anchorStatus)) {
                chainOk = false;
                appendViolation(violations, safeMaxViolations, logId, "ANCHOR_STATUS_NOT_ANCHORED",
                    "anchorStatus=" + anchorStatus);
            }

            if (verifyOnChain) {
                if (!blockchainService.isEnabled()) {
                    chainOk = false;
                    appendViolation(violations, safeMaxViolations, logId, "BLOCKCHAIN_NOT_READY",
                        "Blockchain service is disabled or not ready");
                } else if (!txHash.isBlank()) {
                    try {
                        boolean ok = blockchainService.verifyAnchor(txHash, immutableHash);
                        if (!ok) {
                            chainOk = false;
                            appendViolation(violations, safeMaxViolations, logId, "ONCHAIN_VERIFY_FAILED",
                                "txHash does not match immutableHash on chain");
                        }
                    } catch (Exception ex) {
                        chainOk = false;
                        appendViolation(violations, safeMaxViolations, logId, "ONCHAIN_VERIFY_ERROR", ex.getMessage());
                    }
                }
            }

            previousHash = immutableHash;
        }

        result.put("verifiedAt", LocalDateTime.now());
        result.put("verifyOnChain", verifyOnChain);
        result.put("totalLogs", logs.size());
        result.put("checkedLogs", checked);
        result.put("ok", chainOk && violations.isEmpty());
        result.put("violationCount", violations.size());
        result.put("violations", violations);
        return result;
    }

    private void appendViolation(
        java.util.List<Map<String, Object>> violations,
        int maxViolations,
        Long logId,
        String code,
        String detail
    ) {
        if (violations.size() >= maxViolations) {
            return;
        }
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("logId", logId);
        item.put("code", code);
        item.put("detail", detail);
        violations.add(item);
    }

    /**
     * Backfill legacy logs that were created before hash-chain anchoring.
     */
    @EventListener(ApplicationReadyEvent.class)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void backfillUnchainedLogsOnStartup() {
        if (!backfillOnStartup) {
            log.info("Audit chain backfill on startup is disabled");
            return;
        }

        AuditLog oldestUnchained = auditLogRepository.findFirstByImmutableHashIsNullOrderByIdAsc();
        if (oldestUnchained == null) return;

        AuditLog latestChained = auditLogRepository.findFirstByImmutableHashIsNotNullOrderByIdDesc();
        if (latestChained != null && latestChained.getId() != null
            && oldestUnchained.getId() != null
            && oldestUnchained.getId() < latestChained.getId()) {
            // Skip if unchained rows are older than already-chained rows (would break immutability)
            log.warn("Skip audit backfill: detected legacy unchained rows before chained rows (oldestUnchainedId={}, latestChainedId={}).",
                oldestUnchained.getId(), latestChained.getId());
            return;
        }

        java.util.List<AuditLog> pending = auditLogRepository.findByImmutableHashIsNullOrderByIdAsc();
        if (pending.isEmpty()) return;

        synchronized (chainLock) {
            int success = 0, failed = 0;
            String previousHash = latestChained != null ? safe(latestChained.getImmutableHash()) : "";

            for (AuditLog logRow : pending) {
                try {
                    String currentHash = sha256Hex(buildCanonicalPayload(logRow, previousHash));
                    logRow.setImmutableHash(currentHash);
                    logRow.setAnchoredAt(LocalDateTime.now());

                    if (blockchainService.isEnabled()) {
                        String txHash = blockchainService.anchorSignature(currentHash);
                        logRow.setBlockchainTxHash(txHash);
                        logRow.setAnchorStatus(txHash != null && !txHash.isBlank() ? "ANCHORED" : "HASHED");
                    } else {
                        logRow.setAnchorStatus("HASHED");
                    }

                    auditLogRepository.save(logRow);
                    previousHash = currentHash;
                    success++;
                } catch (Exception ex) {
                    logRow.setAnchorStatus("ANCHOR_FAILED");
                    auditLogRepository.save(logRow);
                    failed++;
                    log.warn("Failed to backfill chain for audit log id={}: {}", logRow.getId(), ex.getMessage());
                }
            }
            log.info("Audit chain backfill completed: success={}, failed={}", success, failed);
        }
    }

    /**
     * Apply LLM-based UEBA analysis for WARNING/FAILURE events.
     * Tier 3 events (screenshots, recordings) use synchronous analysis for immediate response.
     */
    private void applyLlmUebaAnalysis(
            Long userId, String accountId, String action, String category, String result, String ipAddress, LocalDateTime timestamp) {
        if ("UEBA".equalsIgnoreCase(category)) return;

        LlmUebaAnalysisService llmUebaAnalysisService = applicationContext.getBean(LlmUebaAnalysisService.class);

        // Tier 3 security events need immediate synchronous response
        if (isTier3SecurityEvent(action)) {
            log.info("Tier 3 security event detected - performing synchronous analysis for immediate response");
            try {
                LlmAnalysisResult tier3Result = llmUebaAnalysisService.analyzeEventSync(userId, accountId, action, category, result,
                        buildEventDetails(action, category, result), ipAddress, timestamp);
                llmUebaAnalysisService.applyAnalysisResult(tier3Result, userId, accountId, action, tier3Result.getReason(), ipAddress);
                log.info("Tier 3 analysis completed immediately for action={}", action);
            } catch (Exception e) {
                log.error("Failed to apply Tier 3 UEBA analysis result: {}", e.getMessage(), e);
            }
            return;
        }

        // Non-Tier-3 events: async LLM analysis
        llmUebaAnalysisService.analyzeEventAsync(userId, accountId, action, category, result,
                buildEventDetails(action, category, result), ipAddress, timestamp).thenAccept(resultObj -> {
            try {
                llmUebaAnalysisService.applyAnalysisResult(resultObj, userId, accountId, action, resultObj.getReason(), ipAddress);
                log.info("LLM UEBA analysis for {}: anomalous={}, confidence={}, reason={}",
                        action, resultObj.isAnomalous(), resultObj.getConfidence(), resultObj.getReason());
            } catch (Exception e) {
                log.error("Failed to apply LLM UEBA analysis result: {}", e.getMessage(), e);
            }
        });
    }

    private String buildEventDetails(String action, String category, String result) {
        return String.format("action=%s, category=%s, result=%s", action, category, result);
    }

    /**
     * Check if action is a Tier 3 security event requiring synchronous immediate response.
     */
    private boolean isTier3SecurityEvent(String action) {
        if (action == null) return false;
        String upperAction = action.toUpperCase();
        return upperAction.contains("SCREENSHOT_ATTEMPT")
            || upperAction.contains("SCREENSHOT_PRESSED")
            || upperAction.contains("SCREENSHOT_KEY_")       // Sidecar: SCREENSHOT_KEY_PRESSED
            || upperAction.contains("SCREENSHOT_WIN_SHARP")  // Win+Shift+S, Win+Ctrl+Shift+S
            || upperAction.contains("SCREENSHOT_WIN_")      // Win+PrintScreen, Win+Alt+PrintScreen
            || upperAction.contains("SCREENSHOT_MAC")
            || upperAction.contains("SCREENSHOT_TOOL")
            || upperAction.contains("SCREENSHOT_ALT")
            || upperAction.contains("SCREENSHOT_FN")
            || upperAction.contains("SCREENSHOT_WIN_CTRL")
            || upperAction.contains("GAME_BAR")
            || upperAction.contains("SCREEN_RECORDING")
            || upperAction.contains("SCREEN_CAPTURE")
            || upperAction.contains("CLIPBOARD_IMAGE")
            || upperAction.contains("LARGE_CLIPBOARD")
            || upperAction.contains("RAPID_WINDOW")
            || upperAction.contains("HIGH_CPU_BROWSER")
            || upperAction.contains("USB_")
            || upperAction.contains("UNAUTHORIZED_ACCESS")
            // Sidecar UEBA Tier 4 events
            || upperAction.contains("RECORDING_LIKELY")
            || upperAction.contains("RECORDING_TOOL")
            || upperAction.contains("VIRTUAL_DISPLAY")
            || upperAction.contains("CAPTURE_DEVICE")
            || upperAction.contains("AUDIO_RECORDING")
            || upperAction.contains("MONITORED_TOOL")
            || upperAction.contains("CONTENT_PROTECTION")
            || upperAction.contains("PROCESS_TERMINATED")
            || upperAction.contains("WORKSTATION_LOCKED");
    }

    public void logLoginSuccess(Long userId, String accountId, HttpServletRequest request) {
        logEvent(userId, accountId, "LOGIN", "AUTH", "SUCCESS", "User logged in successfully",
                getClientIp(request), getUserAgent(request), getDeviceFingerprint(request));
    }

    public void logLoginFailure(String accountId, String reason, HttpServletRequest request) {
        logEvent(null, accountId, "LOGIN", "AUTH", "FAILURE", "Login failed: " + reason,
                getClientIp(request), getUserAgent(request), getDeviceFingerprint(request));
    }

    public void logLogout(Long userId, String accountId, HttpServletRequest request) {
        logEvent(userId, accountId, "LOGOUT", "AUTH", "SUCCESS", "User logged out",
                getClientIp(request), getUserAgent(request), getDeviceFingerprint(request));
    }

    public void logPasswordChange(Long userId, String accountId, boolean forced, HttpServletRequest request) {
        String details = forced ? "Forced password change completed" : "User changed password";
        logEvent(userId, accountId, "PASSWORD_CHANGE", "AUTH", "SUCCESS", details,
                getClientIp(request), getUserAgent(request), getDeviceFingerprint(request));
    }

    public void logMfaSetup(Long userId, String accountId, HttpServletRequest request) {
        logEvent(userId, accountId, "MFA_SETUP", "AUTH", "SUCCESS", "User enabled MFA",
                getClientIp(request), getUserAgent(request), getDeviceFingerprint(request));
    }

    public void logMfaVerification(Long userId, String accountId, boolean success, HttpServletRequest request) {
        logEvent(userId, accountId, "MFA_VERIFY", "AUTH", success ? "SUCCESS" : "FAILURE",
                "MFA verification " + (success ? "successful" : "failed"),
                getClientIp(request), getUserAgent(request), getDeviceFingerprint(request));
    }

    public void logAccountLockout(Long userId, String accountId, String reason, HttpServletRequest request) {
        logEvent(userId, accountId, "ACCOUNT_LOCKED", "AUTH", "WARNING", "Account locked: " + reason,
                getClientIp(request), getUserAgent(request), getDeviceFingerprint(request));
    }

    public void logTokenRefresh(Long userId, String accountId, HttpServletRequest request) {
        logEvent(userId, accountId, "TOKEN_REFRESH", "AUTH", "SUCCESS", "Access token refreshed",
                getClientIp(request), getUserAgent(request), getDeviceFingerprint(request));
    }

    public void logUserCreation(Long adminUserId, String adminAccountId, String newAccountId, HttpServletRequest request) {
        logEvent(adminUserId, adminAccountId, "USER_CREATED", "ADMIN", "SUCCESS", "Created new user: " + newAccountId,
                getClientIp(request), getUserAgent(request), getDeviceFingerprint(request));
    }

    public void logUserModification(Long adminUserId, String adminAccountId, String targetAccountId, String changes, HttpServletRequest request) {
        logEvent(adminUserId, adminAccountId, "USER_MODIFIED", "ADMIN", "SUCCESS", "Modified user " + targetAccountId + ": " + changes,
                getClientIp(request), getUserAgent(request), getDeviceFingerprint(request));
    }

    public void logUnauthorizedAccess(Long userId, String accountId, String resource, HttpServletRequest request) {
        logEvent(userId, accountId, "UNAUTHORIZED_ACCESS", "AUTH", "FAILURE", "Attempted to access: " + resource,
                getClientIp(request), getUserAgent(request), getDeviceFingerprint(request));
    }

    /** Log document-related action to audit log. */
    public void logDocumentAction(Long userId, String accountId, String action, String result, String details, String ipAddress) {
        logEvent(userId, accountId, action, "DOCUMENT", result, details != null ? details : "",
                ipAddress != null ? ipAddress : "UNKNOWN", null, null);
    }

    /** Log UEBA-related event (score warning, account disable). */
    public void logUebaAction(Long userId, String accountId, String action, String result, String details, String ipAddress) {
        logEvent(userId, accountId, action, "UEBA", result, details != null ? details : "",
                ipAddress != null ? ipAddress : "UNKNOWN", null, null);
    }

    private String getClientIp(HttpServletRequest request) {
        if (request == null) return "UNKNOWN";
        String[] headerNames = { "X-Forwarded-For", "Proxy-Client-IP", "WL-Proxy-Client-IP", "HTTP_X_FORWARDED_FOR", "HTTP_X_FORWARDED", "HTTP_X_CLUSTER_CLIENT_IP", "HTTP_CLIENT_IP", "HTTP_FORWARDED_FOR", "HTTP_FORWARDED", "HTTP_VIA", "REMOTE_ADDR" };
        for (String header : headerNames) {
            String ip = request.getHeader(header);
            if (ip != null && !ip.isEmpty() && !"unknown".equalsIgnoreCase(ip)) {
                if (ip.contains(",")) ip = ip.split(",")[0].trim();
                return ip;
            }
        }
        String remoteAddr = request.getRemoteAddr();
        return remoteAddr != null ? remoteAddr : "UNKNOWN";
    }

    private String getUserAgent(HttpServletRequest request) {
        if (request == null) return "UNKNOWN";
        String userAgent = request.getHeader("User-Agent");
        return userAgent != null ? userAgent : "UNKNOWN";
    }

    private String getDeviceFingerprint(HttpServletRequest request) {
        if (request == null) return "UNKNOWN";
        StringBuilder fingerprint = new StringBuilder();
        String userAgent = getUserAgent(request);
        String acceptLanguage = request.getHeader("Accept-Language");
        String acceptEncoding = request.getHeader("Accept-Encoding");
        fingerprint.append(userAgent.hashCode()).append("-").append(acceptLanguage != null ? acceptLanguage.hashCode() : 0).append("-").append(acceptEncoding != null ? acceptEncoding.hashCode() : 0);
        return fingerprint.toString();
    }

    /** Log IP security events (blocked, frozen, etc.) */
    public void logIpSecurityEvent(String ipAddress, String accountId, String action, String severity, String details, Integer freezeLevel, LocalDateTime freezeUntil) {
        StringBuilder sb = new StringBuilder();
        if (freezeLevel != null) sb.append("freezeLevel=").append(freezeLevel).append(" ");
        if (freezeUntil != null) sb.append("freezeUntil=").append(freezeUntil).append(" ");
        sb.append(details);
        logEvent(null, accountId != null ? accountId : "SYSTEM", action, "SECURITY", "WARNING", sb.toString(), ipAddress, null, null);
    }

    /** Log account security events (lockout, disable, etc.) */
    public void logAccountSecurityEvent(Long userId, String accountId, String action, String reason, String details, String ipAddress) {
        logEvent(userId, accountId, action, "SECURITY", "WARNING", reason + ": " + details, ipAddress, null, null);
    }

    /** Check if blockchain is enabled. */
    public boolean isBlockchainEnabledForGuardian() {
        return blockchainService.isEnabled();
    }

    /** Repair chain integrity for given audit log IDs. */
    public Map<String, Object> repairChain(java.util.List<Long> logIds, String operatorAccountId) {
        Map<String, Object> result = new LinkedHashMap<>();
        int repaired = 0, failed = 0;
        java.util.List<String> errors = new java.util.ArrayList<>();

        for (Long logId : logIds) {
            try {
                AuditLog auditLog = auditLogRepository.findById(logId).orElse(null);
                if (auditLog == null) {
                    this.log.warn("Audit log {} not found for repair", logId);
                    errors.add("Log " + logId + " not found");
                    failed++;
                    continue;
                }

                String previousHash = resolvePreviousHash(logId);
                String currentHash = sha256Hex(buildCanonicalPayload(auditLog, previousHash));
                auditLog.setImmutableHash(currentHash);
                auditLog.setAnchoredAt(LocalDateTime.now());

                if (blockchainService.isEnabled()) {
                    String txHash = blockchainService.anchorSignature(currentHash);
                    auditLog.setBlockchainTxHash(txHash);
                    auditLog.setAnchorStatus(txHash != null && !txHash.isBlank() ? "ANCHORED" : "HASHED");
                } else {
                    auditLog.setAnchorStatus("HASHED");
                }

                auditLogRepository.save(auditLog);
                repaired++;
                this.log.info("Repaired audit log chain: id={}", logId);
            } catch (Exception e) {
                this.log.error("Failed to repair audit log {}: {}", logId, e.getMessage());
                errors.add("Log " + logId + ": " + e.getMessage());
                failed++;
            }
        }

        if (repaired > 0) {
            logEvent(null, operatorAccountId, "CHAIN_REPAIR", "ADMIN", "SUCCESS",
                "Repaired " + repaired + " audit log chain entries", null, null, null);
        }

        result.put("repairedCount", repaired);
        result.put("failedCount", failed);
        result.put("totalCount", logIds.size());
        result.put("errors", errors);
        result.put("status", failed > 0 ? (repaired > 0 ? "PARTIAL" : "FAILED") : "REPAIRED");
        return result;
    }

    /**
     * Log endpoint security events from Electron desktop agent (screenshot attempts, recording detection, USB events, etc.)
     * Severity auto-assigned based on result: FAILURE→HIGH, WARNING→MEDIUM, SUCCESS→LOW
     * Or use provided severity if specified.
     */
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logEndpointSecurityEvent(
            String action, String category, String result, String details, String username, String hostName, String ipAddress, Long userId, String accountId) {
        logEndpointSecurityEvent(action, category, result, null, details, username, hostName, ipAddress, userId, accountId);
    }

    /**
     * Log endpoint security events with optional severity override.
     * @param severityOverride If provided, use this severity instead of auto-calculating from result
     */
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logEndpointSecurityEvent(
            String action, String category, String result, String severityOverride, String details, String username, String hostName, String ipAddress, Long userId, String accountId) {
        try {
            // Skip benign window management events - they are normal browser behavior
            // These events are too frequent and not real security threats
            if (isBenignWindowEvent(action, category)) {
                log.debug("Skipping benign window event: {} [{}]", action, category);
                return;
            }

            // Use provided severity or auto-calculate from result
            // Default: FAILURE=HIGH, WARNING=MEDIUM, SUCCESS=LOW
            String severity = severityOverride;
            if (severity == null || severity.isBlank()) {
                severity = "LOW";
                if ("FAILURE".equalsIgnoreCase(result)) {
                    severity = "HIGH";
                } else if ("WARNING".equalsIgnoreCase(result)) {
                    severity = "MEDIUM";
                }
            }

            String resolvedAccountId = (accountId != null && !accountId.isBlank()) ? accountId : username;
            String fullDetails = details;
            if (username != null || hostName != null) {
                StringBuilder sb = new StringBuilder();
                sb.append("Endpoint: ");
                if (hostName != null) sb.append(hostName);
                sb.append(" | User: ");
                sb.append(resolvedAccountId != null ? resolvedAccountId : "unknown");
                sb.append(" | ");
                sb.append(details != null ? details : "");
                fullDetails = sb.toString();
            }

            AuditLog auditLog = AuditLog.builder()
                    .userId(userId).accountId(resolvedAccountId)
                    .action(action != null ? action : "ENDPOINT_EVENT")
                    .category(category != null ? category : "ENDPOINT")
                    .result(result != null ? result : "WARNING")
                    .severity(severity).details(fullDetails)
                    .ipAddress(ipAddress)  // Use actual IP from Electron endpoint
                    .timestamp(LocalDateTime.now())
                    .build();

            AuditLog saved = auditLogRepository.save(auditLog);
            attachImmutableAnchor(saved);

            if (isTier3SecurityEvent(action)) {
                applyLlmUebaAnalysis(userId, resolvedAccountId, action, category, result, ipAddress, saved.getTimestamp());
            }
            log.debug("Endpoint security event saved: {} - {} - {} [{}]", category, action, result, severity);
        } catch (Exception e) {
            log.error("Failed to save endpoint security event: {}", e.getMessage(), e);
        }
    }

    /** Legacy method for backward compatibility. */
    public void logEndpointSecurityEvent(String action, String category, String result, String details, String username, String hostName) {
        logEndpointSecurityEvent(action, category, result, details, username, hostName, null, null, username);
    }

    /**
     * Check if event is benign window management behavior that should be skipped.
     * These events are normal browser/desktop behavior and not real security threats.
     */
    private boolean isBenignWindowEvent(String action, String category) {
        if (action == null) return false;
        String upperAction = action.toUpperCase();

        // Specific benign window actions (regardless of category)
        return upperAction.contains("WINDOW_BLUR")
            || upperAction.contains("WINDOW_FOCUS")
            || upperAction.contains("PAGE_VISIBLE")
            || upperAction.contains("PAGE_HIDDEN")
            || upperAction.contains("WINDOW_SWITCH")
            || upperAction.contains("ALT_TAB")
            || upperAction.contains("TASK_SWITCH")
            || upperAction.contains("FOCUS_CHANGE")
            || ("WINDOW_MANAGEMENT".equalsIgnoreCase(category));
    }
}
