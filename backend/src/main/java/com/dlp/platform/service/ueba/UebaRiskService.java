package com.dlp.platform.service.ueba;

import com.dlp.platform.repository.AuditLogRepository;
import com.dlp.platform.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class UebaRiskService {

    private static final int DEFAULT_SCORE = 100;

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public Map<String, Object> getRiskScore(Long userId, String sessionId, Long documentId) {
        int score = DEFAULT_SCORE;
        List<String> factors = new ArrayList<>();

        if (userId != null) {
            try {
                score = userRepository.findById(userId)
                        .map(u -> {
                            Integer s = u.getUebaScore();
                            return s != null ? s : DEFAULT_SCORE;
                        })
                        .orElse(DEFAULT_SCORE);
                factors.add("Stored UEBA score (default 100, deducted on anomaly)");
            } catch (Exception e) {
                log.error("Error fetching UEBA score for userId {}: {}", userId, e.getMessage());
                score = DEFAULT_SCORE;
                factors.add("Error fetching score, using default 100");
            }
        } else {
            try {
                Integer lowest = userRepository.findGlobalUebaLowestScore();
                score = lowest != null ? lowest : DEFAULT_SCORE;
                factors.add("Global overview score based on current lowest user UEBA score");
            } catch (Exception e) {
                log.error("Error fetching global UEBA lowest score: {}", e.getMessage());
                score = DEFAULT_SCORE;
                factors.add("Error fetching global score, using default 100");
            }
        }

        String recommendedAction = getRecommendedActionByTier(score);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("userId", userId);
        out.put("sessionId", sessionId);
        out.put("documentId", documentId);
        out.put("score", score);
        out.put("factors", factors);
        out.put("recommendedAction", recommendedAction);
        out.put("tier", score / 10);
        out.put("confidence", 0.8);
        out.put("timestamp", LocalDateTime.now().toString());
        return out;
    }

    /** Every 10 points = tier. 90-100 OK, 80-90 WARNING to admin, 50-60 LOCK, 0-50 DISABLED. */
    private String getRecommendedActionByTier(int score) {
        if (score > 90) return "NONE";
        if (score > 80) return "WARNING_ALERT_ADMIN";
        if (score > 70) return "REVIEW";
        if (score > 60) return "RESTRICT";
        if (score > 50) return "LOCK";
        return "DISABLED";
    }

    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<Map<String, Object>> getIncidents(
            String severity,
            String status,
            org.springframework.data.domain.Pageable pageable
    ) {
        // Exclude SYSTEM category — those are internal events (e.g., CHAIN_GUARDIAN_ALERT)
        // that do not have associated real user IDs and should not appear as UEBA incidents.
        List<String> categories = Arrays.asList("AUTH", "DOCUMENT");
        List<String> results = Arrays.asList("FAILURE", "WARNING");
        List<com.dlp.platform.entity.AuditLog> logs = auditLogRepository
                .findTop50ByCategoryInAndResultInOrderByTimestampDesc(categories, results);

        List<Map<String, Object>> incidents = logs.stream()
                .map(log -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", log.getId());
                    m.put("userId", log.getUserId());
                    m.put("accountId", log.getAccountId());
                    m.put("riskScore", "FAILURE".equals(log.getResult()) ? 65 : 40);
                    m.put("severity", "FAILURE".equals(log.getResult()) ? "HIGH" : "MEDIUM");
                    m.put("action", log.getAction());
                    m.put("category", log.getCategory());
                    m.put("timestamp", log.getTimestamp());
                    m.put("status", "OPEN");
                    m.put("factors", Collections.singletonList(log.getDetails()));
                    return m;
                })
                .collect(Collectors.toList());

        if (severity != null && !severity.isBlank()) {
            String sev = severity.toUpperCase();
            incidents = incidents.stream()
                    .filter(m -> sev.equals(m.get("severity")))
                    .collect(Collectors.toList());
        }
        if (status != null && !status.isBlank()) {
            String st = status.toUpperCase();
            incidents = incidents.stream()
                    .filter(m -> st.equals(m.get("status")))
                    .collect(Collectors.toList());
        }

        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), incidents.size());
        List<Map<String, Object>> pageContent = start < incidents.size()
                ? incidents.subList(start, end)
                : Collections.emptyList();

        return new org.springframework.data.domain.PageImpl<>(
                pageContent,
                pageable,
                incidents.size()
        );
    }

    public Map<String, Object> getBaseline(Long userId) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("userId", userId);
        out.put("established", false);
        out.put("message", "Baseline not yet established (7-day learning period).");
        out.put("timestamp", LocalDateTime.now().toString());
        return out;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getFeatures(Long userId, String timeRange) {
        var pageable = org.springframework.data.domain.PageRequest.of(0, 200,
                org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "timestamp"));
        var page = auditLogRepository.findByUserId(userId, pageable);
        List<Map<String, Object>> features = new ArrayList<>();
        for (com.dlp.platform.entity.AuditLog logEntry : page.getContent()) {
            Map<String, Object> f = new LinkedHashMap<>();
            f.put("timestamp", logEntry.getTimestamp());
            f.put("action", logEntry.getAction());
            f.put("category", logEntry.getCategory());
            f.put("result", logEntry.getResult());
            f.put("ipAddress", logEntry.getIpAddress());
            features.add(f);
        }
        return features;
    }

    public Map<String, Object> investigateIncident(Long id, Map<String, Object> body) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("status", body != null && body.containsKey("status") ? body.get("status") : "INVESTIGATING");
        out.put("analystNotes", body != null ? body.get("analystNotes") : null);
        out.put("investigatedAt", LocalDateTime.now().toString());
        return out;
    }
}
