package com.dlp.platform.service.dashboard;

import com.dlp.platform.dto.audit.AuditLogSearchCriteria;
import com.dlp.platform.entity.AuditLog;
import com.dlp.platform.entity.Task;
import com.dlp.platform.entity.User;
import com.dlp.platform.repository.AuditLogRepository;
import com.dlp.platform.repository.TaskRepository;
import com.dlp.platform.repository.UserRepository;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SecurityAnalyticsService {

    private final AuditLogRepository auditLogRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getRecentAuditEvents() {
        List<AuditLog> logs = auditLogRepository.findTop50ByOrderByTimestampDesc();
        Map<Long, User> users = buildUserLookup(logs);
        return logs.stream().map(log -> toAuditMap(log, users)).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getRecentIncidents() {
        List<String> categories = Arrays.asList("AUTH", "DOCUMENT", "SYSTEM");
        List<String> results = Arrays.asList("FAILURE", "WARNING");
        List<AuditLog> logs = auditLogRepository.findTop50ByCategoryInAndResultInOrderByTimestampDesc(categories, results);
        Map<Long, User> users = buildUserLookup(logs);
        return logs.stream().map(log -> toIncidentMap(log, users)).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getInvestigations() {
        return getRecentIncidents().stream()
                .map(incident -> {
                    Map<String, Object> copy = new LinkedHashMap<>(incident);
                    copy.put("type", "INVESTIGATION");
                    return copy;
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Page<Map<String, Object>> searchAuditLogs(AuditLogSearchCriteria criteria, Pageable pageable) {
        Specification<AuditLog> spec = buildAuditLogSpecification(criteria);
        Page<AuditLog> logs = auditLogRepository.findAll(spec, pageable);
        Map<Long, User> userMap = buildUserLookup(logs.getContent());
        List<Map<String, Object>> mapped = logs.getContent().stream().map(log -> toAuditMap(log, userMap)).collect(Collectors.toList());
        return new PageImpl<>(mapped, pageable, logs.getTotalElements());
    }

    public Map<String, Object> getTeamWorkloadSummary() {
        List<Task> allTasks = taskRepository.findAll();
        LocalDateTime now = LocalDateTime.now();
        long total = allTasks.size();
        long pending = allTasks.stream().filter(t -> t.getStatus() == Task.TaskStatus.PENDING).count();
        long inProgress = allTasks.stream().filter(t -> t.getStatus() == Task.TaskStatus.IN_PROGRESS).count();
        long completed = allTasks.stream().filter(t -> t.getStatus() == Task.TaskStatus.COMPLETED).count();
        long overdue = allTasks.stream().filter(t -> isOverdue(t, now)).count();
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("totalTasks", total);
        map.put("pending", pending);
        map.put("inProgress", inProgress);
        map.put("completed", completed);
        map.put("overdue", overdue);
        return map;
    }

    public Map<String, Object> getSlaBreachesSummary() {
        LocalDateTime now = LocalDateTime.now();
        List<Task> overdueTasks = taskRepository.findOverdueTasks(now);
        long total = overdueTasks.size();
        long critical = overdueTasks.stream().filter(t -> t.getUrgencyLevel() == Task.UrgencyLevel.CRITICAL).count();
        long high = overdueTasks.stream().filter(t -> t.getUrgencyLevel() == Task.UrgencyLevel.HIGH).count();
        long medium = overdueTasks.stream().filter(t -> t.getUrgencyLevel() == Task.UrgencyLevel.NORMAL).count();
        long low = overdueTasks.stream().filter(t -> t.getUrgencyLevel() == Task.UrgencyLevel.LOW).count();
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("totalBreaches", total);
        map.put("critical", critical);
        map.put("high", high);
        map.put("medium", medium);
        map.put("low", low);
        return map;
    }

    private boolean isOverdue(Task task, LocalDateTime now) {
        return task.getDueDate() != null && task.getStatus() == Task.TaskStatus.PENDING && now.isAfter(task.getDueDate());
    }

    private Map<String, Object> toAuditMap(AuditLog log, Map<Long, User> userMap) {
        Map<String, Object> map = new LinkedHashMap<>();
        String safeDetails = safeReadDetails(log);
        map.put("id", log.getId());
        map.put("userId", log.getUserId());
        map.put("accountId", log.getAccountId());
        map.put("userName", log.getUserId() != null && userMap.containsKey(log.getUserId()) ? userMap.get(log.getUserId()).getFullName() != null ? userMap.get(log.getUserId()).getFullName() : userMap.get(log.getUserId()).getAccountId() : log.getAccountId());
        map.put("action", log.getAction());
        map.put("category", log.getCategory());
        map.put("result", log.getResult());
        map.put("details", safeDetails);
        map.put("ipAddress", log.getIpAddress());
        map.put("resource", safeDetails);
        map.put("immutableHash", log.getImmutableHash());
        map.put("blockchainTxHash", log.getBlockchainTxHash());
        map.put("anchorStatus", log.getAnchorStatus());
        map.put("anchoredAt", log.getAnchoredAt());
        map.put("timestamp", log.getTimestamp());
        // Calculate severity for frontend consistency (matches frontend getSeverity logic)
        map.put("severity", calculateSeverity(log.getResult(), log.getAction()));
        return map;
    }

    private String calculateSeverity(String result, String action) {
        // Screen recording/screenshot attempts are always HIGH severity
        if (action != null && (
            action.contains("SCREENSHOT") ||
            action.contains("SCREEN_RECORD") ||
            action.contains("CLIPBOARD_IMAGE") ||
            action.contains("SCREEN_CAPTURE")
        )) {
            return "HIGH";
        }
        // DENIED or FAILURE = HIGH severity
        if ("FAILURE".equalsIgnoreCase(result) || "DENIED".equalsIgnoreCase(result)) return "HIGH";
        if ("WARNING".equalsIgnoreCase(result)) return "MEDIUM";
        return "LOW";
    }

    private String safeReadDetails(AuditLog auditLog) {
        try {
            return auditLog.getDetails();
        } catch (Exception ex) {
            log.warn("Failed to read audit details for log id={}, returning placeholder", auditLog.getId());
            return "[details unavailable]";
        }
    }

    private Map<String, Object> toIncidentMap(AuditLog log, Map<Long, User> userMap) {
        Map<String, Object> map = toAuditMap(log, userMap);
        map.put("severity", "FAILURE".equalsIgnoreCase(log.getResult()) ? "HIGH" : "WARNING".equalsIgnoreCase(log.getResult()) ? "MEDIUM" : "LOW");
        map.put("summary", buildIncidentSummary(log));
        return map;
    }

    private Map<Long, User> buildUserLookup(List<AuditLog> logs) {
        Set<Long> ids = logs.stream().map(AuditLog::getUserId).filter(Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) return Collections.emptyMap();
        return userRepository.findAllById(ids).stream().collect(Collectors.toMap(User::getId, user -> user));
    }

    private String buildIncidentSummary(AuditLog log) {
        String category = log.getCategory();
        String prefix = category == null ? "System event" : switch (category != null ? category : "") {
            case "AUTH" -> "Authentication event";
            case "DOCUMENT" -> "Document event";
            case "ADMIN" -> "Admin action";
            default -> "System event";
        };
        return prefix + " - " + log.getAction();
    }

    private Specification<AuditLog> buildAuditLogSpecification(AuditLogSearchCriteria criteria) {
        return (root, query, cb) -> {
            if (criteria == null) return cb.conjunction();
            List<Predicate> predicates = new ArrayList<>();
            if (criteria.getStartTime() != null) predicates.add(cb.greaterThanOrEqualTo(root.get("timestamp"), criteria.getStartTime()));
            if (criteria.getEndTime() != null) predicates.add(cb.lessThanOrEqualTo(root.get("timestamp"), criteria.getEndTime()));
            if (criteria.getUserId() != null) predicates.add(cb.equal(root.get("userId"), criteria.getUserId()));
            if (StringUtils.hasText(criteria.getAccountId())) {
                predicates.add(cb.like(cb.lower(cb.coalesce(root.get("accountId"), "")), "%" + criteria.getAccountId().trim().toLowerCase(Locale.ROOT) + "%"));
            }
            if (StringUtils.hasText(criteria.getUserName())) {
                String normalized = criteria.getUserName().trim().toLowerCase(Locale.ROOT);
                List<Long> userIds = userRepository.findByFullNameContainingIgnoreCase(criteria.getUserName().trim()).stream().map(User::getId).collect(Collectors.toList());
                List<Predicate> orPredicates = new ArrayList<>();
                if (!userIds.isEmpty()) orPredicates.add(root.get("userId").in(userIds));
                orPredicates.add(cb.like(cb.lower(cb.coalesce(root.get("accountId"), "")), "%" + normalized + "%"));
                predicates.add(cb.or(orPredicates.toArray(new Predicate[0])));
            }
            if (StringUtils.hasText(criteria.getSeverity()) && !"all".equalsIgnoreCase(criteria.getSeverity())) {
                String severity = criteria.getSeverity().trim().toUpperCase(Locale.ROOT);
                switch (severity) {
                    case "HIGH" -> {
                        // HIGH includes: FAILURE/DENIED results OR screenshot/screen capture actions
                        Predicate resultHigh = cb.equal(root.get("result"), "FAILURE");
                        Expression<String> actionExpr = cb.coalesce(root.get("action"), "");
                        Predicate screenshotAction = cb.or(
                            cb.like(actionExpr, "%SCREENSHOT%"),
                            cb.like(actionExpr, "%SCREEN_RECORD%"),
                            cb.like(actionExpr, "%CLIPBOARD_IMAGE%"),
                            cb.like(actionExpr, "%SCREEN_CAPTURE%")
                        );
                        predicates.add(cb.or(resultHigh, screenshotAction));
                    }
                    case "MEDIUM" -> {
                        // MEDIUM is WARNING, but not screenshot/screen capture (those are HIGH)
                        Predicate resultMedium = cb.equal(root.get("result"), "WARNING");
                        Expression<String> actionExpr = cb.coalesce(root.get("action"), "");
                        Predicate notScreenshotAction = cb.and(
                            cb.not(cb.like(actionExpr, "%SCREENSHOT%")),
                            cb.not(cb.like(actionExpr, "%SCREEN_RECORD%")),
                            cb.not(cb.like(actionExpr, "%CLIPBOARD_IMAGE%")),
                            cb.not(cb.like(actionExpr, "%SCREEN_CAPTURE%"))
                        );
                        predicates.add(cb.and(resultMedium, notScreenshotAction));
                    }
                    case "LOW" -> predicates.add(cb.not(cb.or(cb.equal(root.get("result"), "FAILURE"), cb.equal(root.get("result"), "WARNING"))));
                    default -> {}
                }
            }
            if (StringUtils.hasText(criteria.getSearchTerm())) {
                String term = "%" + criteria.getSearchTerm().trim().toLowerCase(Locale.ROOT) + "%";
                Expression<String> actionExpr = cb.lower(cb.coalesce(root.get("action"), ""));
                Expression<String> detailsExpr = cb.lower(cb.coalesce(root.get("details"), ""));
                Expression<String> categoryExpr = cb.lower(cb.coalesce(root.get("category"), ""));
                Expression<String> resultExpr = cb.lower(cb.coalesce(root.get("result"), ""));
                Expression<String> ipExpr = cb.lower(cb.coalesce(root.get("ipAddress"), ""));
                Expression<String> accountExpr = cb.lower(cb.coalesce(root.get("accountId"), ""));
                predicates.add(cb.or(
                    cb.like(actionExpr, term),
                    cb.like(detailsExpr, term),
                    cb.like(categoryExpr, term),
                    cb.like(resultExpr, term),
                    cb.like(ipExpr, term),
                    cb.like(accountExpr, term)
                ));
            }
            if (StringUtils.hasText(criteria.getAction())) predicates.add(cb.equal(root.get("action"), criteria.getAction().trim()));
            if (StringUtils.hasText(criteria.getCategory())) predicates.add(cb.equal(root.get("category"), criteria.getCategory().trim().toUpperCase(Locale.ROOT)));
            if (StringUtils.hasText(criteria.getResult())) predicates.add(cb.equal(root.get("result"), criteria.getResult().trim().toUpperCase(Locale.ROOT)));
            if (criteria.getDocumentId() != null) predicates.add(cb.like(cb.lower(cb.coalesce(root.get("details"), "")), "%document " + criteria.getDocumentId() + "%"));
            return predicates.isEmpty() ? cb.conjunction() : cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
