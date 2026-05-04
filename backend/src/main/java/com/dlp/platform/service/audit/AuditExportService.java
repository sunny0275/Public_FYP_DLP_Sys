package com.dlp.platform.service.audit;

import com.dlp.platform.dto.audit.AuditLogSearchCriteria;
import com.dlp.platform.entity.AuditLog;
import com.dlp.platform.entity.User;
import com.dlp.platform.repository.AuditLogRepository;
import com.dlp.platform.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class AuditExportService {

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public byte[] exportAsCsv(AuditLogSearchCriteria criteria, Pageable pageable) throws IOException {
        Specification<AuditLog> spec = buildSpecification(criteria);
        List<AuditLog> logs = auditLogRepository.findAll(spec, pageable).getContent();
        Map<Long, User> userMap = buildUserLookup(logs);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PrintWriter writer = new PrintWriter(baos, true, StandardCharsets.UTF_8);
        writer.println("ID,Timestamp,User ID,Account ID,User Name,Action,Category,Result,IP Address,Device Fingerprint,Details");
        for (AuditLog logEntry : logs) {
            String userName = resolveUserName(logEntry, userMap);
            writer.printf("%d,%s,%s,%s,%s,%s,%s,%s,%s,%s,\"%s\"%n",
                    logEntry.getId(),
                    logEntry.getTimestamp() != null ? logEntry.getTimestamp().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME) : "",
                    logEntry.getUserId() != null ? logEntry.getUserId() : "",
                    escapeCsv(logEntry.getAccountId()),
                    escapeCsv(userName),
                    escapeCsv(logEntry.getAction()),
                    escapeCsv(logEntry.getCategory()),
                    escapeCsv(logEntry.getResult()),
                    escapeCsv(logEntry.getIpAddress()),
                    escapeCsv(logEntry.getDeviceFingerprint()),
                    escapeCsv(logEntry.getDetails())
            );
        }
        writer.flush();
        return baos.toByteArray();
    }

    public String generateReportHash(byte[] reportContent) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(reportContent);
            return Base64.getEncoder().encodeToString(hashBytes);
        } catch (NoSuchAlgorithmException e) {
            log.error("Failed to generate report hash", e);
            return "";
        }
    }

    public Map<String, Object> buildExportMetadata(byte[] reportContent, String format) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("format", format);
        metadata.put("generatedAt", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        metadata.put("hash", generateReportHash(reportContent));
        metadata.put("hashAlgorithm", "SHA-256");
        metadata.put("size", reportContent.length);
        return metadata;
    }

    private Specification<AuditLog> buildSpecification(AuditLogSearchCriteria criteria) {
        return (root, query, cb) -> {
            if (criteria == null) return cb.conjunction();
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            if (criteria.getStartTime() != null) predicates.add(cb.greaterThanOrEqualTo(root.get("timestamp"), criteria.getStartTime()));
            if (criteria.getEndTime() != null) predicates.add(cb.lessThanOrEqualTo(root.get("timestamp"), criteria.getEndTime()));
            if (criteria.getUserId() != null) predicates.add(cb.equal(root.get("userId"), criteria.getUserId()));
            if (criteria.getAction() != null && !criteria.getAction().trim().isEmpty()) predicates.add(cb.equal(root.get("action"), criteria.getAction().trim()));
            if (criteria.getCategory() != null && !criteria.getCategory().trim().isEmpty()) predicates.add(cb.equal(root.get("category"), criteria.getCategory().trim().toUpperCase()));
            if (criteria.getResult() != null && !criteria.getResult().trim().isEmpty()) predicates.add(cb.equal(root.get("result"), criteria.getResult().trim().toUpperCase()));
            if (org.springframework.util.StringUtils.hasText(criteria.getSearchTerm())) {
                String term = "%" + criteria.getSearchTerm().trim().toLowerCase() + "%";
                jakarta.persistence.criteria.Expression<String> detailsExpr = cb.lower(cb.coalesce(root.get("details"), ""));
                jakarta.persistence.criteria.Expression<String> actionExpr = cb.lower(cb.coalesce(root.get("action"), ""));
                predicates.add(cb.or(cb.like(detailsExpr, term), cb.like(actionExpr, term)));
            }
            return predicates.isEmpty() ? cb.conjunction() : cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }

    private Map<Long, User> buildUserLookup(List<AuditLog> logs) {
        Set<Long> userIds = logs.stream().map(AuditLog::getUserId).filter(Objects::nonNull).collect(Collectors.toSet());
        if (userIds.isEmpty()) return Collections.emptyMap();
        return userRepository.findAllById(userIds).stream().collect(Collectors.toMap(User::getId, user -> user));
    }

    private String resolveUserName(AuditLog logEntry, Map<Long, User> userMap) {
        if (logEntry.getUserId() != null && userMap.containsKey(logEntry.getUserId())) {
            User user = userMap.get(logEntry.getUserId());
            return user.getFullName() != null ? user.getFullName() : user.getAccountId();
        }
        return logEntry.getAccountId() != null ? logEntry.getAccountId() : "Unknown";
    }

    private String escapeCsv(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) return "\"" + value.replace("\"", "\"\"") + "\"";
        return value;
    }
}
