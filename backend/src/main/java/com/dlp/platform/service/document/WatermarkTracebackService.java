package com.dlp.platform.service.document;

import com.dlp.platform.entity.AuditLog;
import com.dlp.platform.entity.User;
import com.dlp.platform.entity.WatermarkFingerprint;
import com.dlp.platform.repository.AuditLogRepository;
import com.dlp.platform.repository.UserRepository;
import com.dlp.platform.repository.WatermarkFingerprintRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@Slf4j
@RequiredArgsConstructor
public class WatermarkTracebackService {

    private final AuditLogRepository auditLogRepository;
    private final WatermarkFingerprintRepository watermarkFingerprintRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public Map<String, Object> tracebackByWatermarkInfo(
            String userAccountId, Long documentId, String documentName, String ipAddress,
            String shortCode, String payloadHash, LocalDateTime startTime, LocalDateTime endTime, int page, int size) {
        log.info("Watermark traceback: userAccountId={}, documentId={}, shortCode={}", userAccountId, documentId, shortCode);

        if (StringUtils.hasText(shortCode)) {
            Map<String, Object> directResult = tracebackByShortCode(shortCode, 0, size);
            if (Boolean.TRUE.equals(directResult.get("found"))) {
                directResult.put("searchCriteria", buildSearchCriteriaSummary(userAccountId, documentId, documentName, ipAddress, shortCode, payloadHash, startTime, endTime));
                directResult.put("searchType", "SHORT_CODE_EXACT_MATCH");
                return directResult;
            }
        }

        if (StringUtils.hasText(payloadHash)) {
            Map<String, Object> directResult = tracebackByPayloadHash(payloadHash);
            if (Boolean.TRUE.equals(directResult.get("found"))) {
                directResult.put("searchCriteria", buildSearchCriteriaSummary(userAccountId, documentId, documentName, ipAddress, shortCode, payloadHash, startTime, endTime));
                directResult.put("searchType", "PAYLOAD_HASH_EXACT_MATCH");
                return directResult;
            }
        }

        Long resolvedUserId = null;
        if (StringUtils.hasText(userAccountId)) {
            Optional<User> user = userRepository.findByAccountId(userAccountId.trim());
            if (user.isPresent()) resolvedUserId = user.get().getId();
        }

        Specification<AuditLog> spec = buildSearchSpecification(resolvedUserId, documentId, documentName, ipAddress, startTime, endTime, false);
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "timestamp"));
        Page<AuditLog> results = auditLogRepository.findAll(spec, pageable);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", results.getContent());
        response.put("totalElements", results.getTotalElements());
        response.put("totalPages", results.getTotalPages());
        response.put("currentPage", results.getNumber());
        response.put("pageSize", results.getSize());

        List<Map<String, Object>> allFingerprints = new ArrayList<>();
        if (documentId == null && resolvedUserId == null && !StringUtils.hasText(shortCode) && !StringUtils.hasText(payloadHash)) {
            List<WatermarkFingerprint> timeFilteredFingerprints = findFingerprintsByTimeRange(startTime, endTime);
            for (WatermarkFingerprint fp : timeFilteredFingerprints) allFingerprints.add(fingerprintToMap(fp));
        } else {
            if (documentId != null) {
                for (WatermarkFingerprint fp : watermarkFingerprintRepository.findByDocumentId(documentId)) allFingerprints.add(fingerprintToMap(fp));
            }
            if (resolvedUserId != null) {
                for (WatermarkFingerprint fp : watermarkFingerprintRepository.findAllByUserId(resolvedUserId)) {
                    Map<String, Object> fpMap = fingerprintToMap(fp);
                    if (allFingerprints.stream().noneMatch(f -> f.get("id").equals(fpMap.get("id")))) allFingerprints.add(fpMap);
                }
            }
        }
        if (!allFingerprints.isEmpty()) response.put("fingerprints", allFingerprints);

        if (StringUtils.hasText(shortCode)) {
            Map<String, Object> shortCodeInfo = new LinkedHashMap<>();
            shortCodeInfo.put("shortCode", shortCode);
            shortCodeInfo.put("found", false);
            shortCodeInfo.put("message", "No fingerprint found for this short code");
            response.put("shortCodeLookup", shortCodeInfo);
        }

        response.put("searchCriteria", buildSearchCriteriaSummary(userAccountId, documentId, documentName, ipAddress, shortCode, payloadHash, startTime, endTime));
        response.put("searchType", "AUDIT_LOG_SEARCH");
        response.put("resolvedUserId", resolvedUserId);
        response.put("resolvedUserAccountId", userAccountId);
        log.info("Watermark traceback found {} results (total: {})", results.getNumberOfElements(), results.getTotalElements());
        return response;
    }

    private String buildSearchCriteriaSummary(String userAccountId, Long documentId, String documentName, String ipAddress,
                                            String shortCode, String payloadHash, LocalDateTime startTime, LocalDateTime endTime) {
        List<String> criteria = new ArrayList<>();
        if (StringUtils.hasText(userAccountId)) criteria.add("UID: " + userAccountId);
        if (documentId != null) criteria.add("Doc ID: #" + documentId);
        if (StringUtils.hasText(documentName)) criteria.add("Document Name: " + documentName);
        if (StringUtils.hasText(ipAddress)) criteria.add("IP: " + ipAddress);
        if (StringUtils.hasText(shortCode)) criteria.add("Short Code: " + shortCode);
        if (StringUtils.hasText(payloadHash)) criteria.add("Payload Hash: " + payloadHash.substring(0, Math.min(16, payloadHash.length())) + "...");
        if (startTime != null) criteria.add("Start: " + startTime);
        if (endTime != null) criteria.add("End: " + endTime);
        return String.join(" | ", criteria);
    }

    private Map<String, Object> fingerprintToMap(WatermarkFingerprint fp) {
        Map<String, Object> fpMap = new LinkedHashMap<>();
        fpMap.put("id", fp.getId());
        fpMap.put("payloadHash", fp.getPayloadHash());
        fpMap.put("shortCode", fp.getShortCode());
        fpMap.put("userId", fp.getUserId());
        fpMap.put("documentId", fp.getDocumentId());
        fpMap.put("deviceId", fp.getDeviceId());
        fpMap.put("createdAt", fp.getCreatedAt() != null ? fp.getCreatedAt().toString() : null);
        if (fp.getUserId() != null) {
            userRepository.findById(fp.getUserId()).ifPresent(user -> {
                fpMap.put("userAccountId", user.getAccountId());
                fpMap.put("userFullName", user.getFullName());
                fpMap.put("userDepartment", user.getDepartment());
            });
        }
        return fpMap;
    }

    @Transactional(readOnly = true)
    public List<WatermarkFingerprint> findFingerprintsByTimeRange(LocalDateTime startTime, LocalDateTime endTime) {
        if (startTime == null && endTime == null) return watermarkFingerprintRepository.findTop500ByOrderByCreatedAtDesc();
        return watermarkFingerprintRepository.findByCreatedAtBetween(startTime, endTime);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> tracebackByShortCode(String shortCode, int page, int size) {
        log.info("Watermark traceback by shortCode: {}", shortCode);
        if (!StringUtils.hasText(shortCode)) throw new IllegalArgumentException("Short code cannot be empty");

        String normalizedCode = shortCode.trim();
        if (normalizedCode.startsWith("#")) normalizedCode = normalizedCode.substring(1).trim();
        normalizedCode = normalizedCode.toUpperCase();

        Optional<WatermarkFingerprint> fpOpt = watermarkFingerprintRepository.findByShortCodeIgnoreCase(normalizedCode);

        if (fpOpt.isEmpty()) {
            List<WatermarkFingerprint> partialMatches = watermarkFingerprintRepository.findByShortCodeStartsWithIgnoreCase(normalizedCode);
            if (!partialMatches.isEmpty()) {
                Map<String, Object> response = new LinkedHashMap<>();
                response.put("found", true);
                response.put("shortCode", normalizedCode);
                response.put("partialMatch", true);
                response.put("message", "Showing fingerprints that start with: " + normalizedCode);
                response.put("fingerprints", partialMatches.stream().map(this::fingerprintToMap).toList());
                response.put("totalFingerprints", partialMatches.size());
                response.put("accessLogs", List.of());
                response.put("totalAccessLogs", 0);
                return response;
            }
            Map<String, Object> notFound = new LinkedHashMap<>();
            notFound.put("found", false);
            notFound.put("shortCode", normalizedCode);
            notFound.put("message", "No fingerprint found for this short code");
            return notFound;
        }

        WatermarkFingerprint fp = fpOpt.get();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("found", true);
        response.put("shortCode", normalizedCode);
        response.put("partialMatch", false);

        Map<String, Object> fingerprintInfo = new LinkedHashMap<>();
        fingerprintInfo.put("id", fp.getId());
        fingerprintInfo.put("payloadHash", fp.getPayloadHash());
        fingerprintInfo.put("shortCode", fp.getShortCode());
        fingerprintInfo.put("userId", fp.getUserId());
        fingerprintInfo.put("documentId", fp.getDocumentId());
        fingerprintInfo.put("deviceId", fp.getDeviceId());
        fingerprintInfo.put("createdAt", fp.getCreatedAt() != null ? fp.getCreatedAt().toString() : null);
        if (fp.getUserId() != null) {
            userRepository.findById(fp.getUserId()).ifPresent(user -> {
                fingerprintInfo.put("userAccountId", user.getAccountId());
                fingerprintInfo.put("userFullName", user.getFullName());
                fingerprintInfo.put("userEmail", user.getEmail());
                fingerprintInfo.put("userDepartment", user.getDepartment());
            });
        }
        response.put("fingerprint", fingerprintInfo);

        Long docId = fp.getDocumentId();
        Long userId = fp.getUserId();
        String userAccountId = null;
        if (userId != null) {
            userAccountId = userRepository.findById(userId).map(User::getAccountId).orElse(null);
            response.put("resolvedUserId", userId);
            response.put("resolvedUserAccountId", userAccountId);
        }

        Specification<AuditLog> spec = buildSearchSpecificationForTraceback(docId, userAccountId, fp.getPayloadHash(), true);
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "timestamp"));
        Page<AuditLog> results = auditLogRepository.findAll(spec, pageable);
        List<AuditLog> accessLogs = new ArrayList<>(results.getContent());

        if (accessLogs.isEmpty() && userId != null && fp.getCreatedAt() != null) {
            LocalDateTime fingerprintTime = fp.getCreatedAt();
            LocalDateTime startT = fingerprintTime.minus(1, ChronoUnit.MINUTES);
            LocalDateTime endT = fingerprintTime.plusSeconds(30);
            List<AuditLog> exactTimeLogs = auditLogRepository.findByUserIdAndActionAndTimeRange(userId, "VIEW", startT, endT);
            if (!exactTimeLogs.isEmpty()) {
                accessLogs.addAll(exactTimeLogs);
                response.put("auditLogsFallback", true);
                response.put("auditLogsFallbackReason", "Fallback: exact watermark time window");
            }
        }

        if (accessLogs.isEmpty() && userId != null && fp.getCreatedAt() != null) {
            LocalDateTime fingerprintTime = fp.getCreatedAt();
            LocalDateTime startT = fingerprintTime.minus(5, ChronoUnit.MINUTES);
            LocalDateTime endT = fingerprintTime.plus(5, ChronoUnit.MINUTES);
            List<AuditLog> nearbyLogs = auditLogRepository.findByUserIdAndActionAndTimeRange(userId, "VIEW", startT, endT);
            if (!nearbyLogs.isEmpty()) {
                List<AuditLog> closestLogs = nearbyLogs.stream()
                        .filter(log -> Math.abs(java.time.Duration.between(log.getTimestamp(), fingerprintTime).toMinutes()) <= 2)
                        .limit(5).toList();
                if (!closestLogs.isEmpty()) {
                    accessLogs.addAll(closestLogs);
                    response.put("auditLogsFallback", true);
                    response.put("auditLogsFallbackReason", "Fallback: logs within 2 minutes");
                }
            }
        }

        response.put("accessLogs", accessLogs);
        response.put("totalAccessLogs", accessLogs.size());

        if (docId != null) {
            List<WatermarkFingerprint> allDocFingerprints = watermarkFingerprintRepository.findByDocumentId(docId);
            response.put("allDocumentFingerprints", allDocFingerprints.stream().map(this::fingerprintToMap).toList());
        }
        if (fp.getUserId() != null) {
            List<WatermarkFingerprint> allUserFingerprints = watermarkFingerprintRepository.findAllByUserId(fp.getUserId());
            if (!allUserFingerprints.isEmpty()) {
                List<Map<String, Object>> fingerprintList = new ArrayList<>();
                for (WatermarkFingerprint userFp : allUserFingerprints) fingerprintList.add(fingerprintToMap(userFp));
                response.put("allUserFingerprints", fingerprintList);
            }
        }
        return response;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> tracebackByPayloadHash(String payloadHash) {
        log.info("Watermark traceback by payloadHash: {}", payloadHash);
        if (!StringUtils.hasText(payloadHash)) throw new IllegalArgumentException("Payload hash cannot be empty");

        Optional<WatermarkFingerprint> fpOpt = watermarkFingerprintRepository.findByPayloadHash(payloadHash.trim());
        if (fpOpt.isEmpty()) {
            Map<String, Object> notFound = new LinkedHashMap<>();
            notFound.put("found", false);
            notFound.put("payloadHash", payloadHash);
            notFound.put("message", "No fingerprint found for this payload hash");
            return notFound;
        }

        WatermarkFingerprint fp = fpOpt.get();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("found", true);
        response.put("payloadHash", payloadHash);
        response.put("fingerprint", fingerprintToMap(fp));

        Specification<AuditLog> spec = buildSearchSpecification(fp.getUserId(), fp.getDocumentId(), null, null, null, null, true);
        Pageable pageable = PageRequest.of(0, 100, Sort.by(Sort.Direction.DESC, "timestamp"));
        Page<AuditLog> results = auditLogRepository.findAll(spec, pageable);
        response.put("accessLogs", results.getContent());
        response.put("totalAccessLogs", results.getTotalElements());
        return response;
    }

    private Specification<AuditLog> buildSearchSpecification(
            Long userId, Long documentId, String documentName, String ipAddress,
            LocalDateTime startTime, LocalDateTime endTime, boolean includeSecurityEvents) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (userId != null) predicates.add(cb.equal(root.get("userId"), userId));
            if (startTime != null) predicates.add(cb.greaterThanOrEqualTo(root.get("timestamp"), startTime));
            if (endTime != null) predicates.add(cb.lessThanOrEqualTo(root.get("timestamp"), endTime));

            if (documentId != null) {
                String docIdPatternNew = "#" + documentId;
                String docIdPatternOld = "DocID:" + documentId;
                predicates.add(cb.or(
                        cb.like(cb.function("LOWER", String.class, cb.lower(root.get("details"))), "%" + docIdPatternNew.toLowerCase() + "%"),
                        cb.like(cb.function("LOWER", String.class, cb.lower(root.get("details"))), "%" + docIdPatternOld.toLowerCase() + "%")));
            }
            if (StringUtils.hasText(documentName)) {
                predicates.add(cb.like(cb.function("LOWER", String.class, cb.lower(root.get("details"))), "%" + documentName.toLowerCase() + "%"));
            }
            if (StringUtils.hasText(ipAddress)) {
                predicates.add(cb.like(root.get("ipAddress"), "%" + ipAddress + "%"));
            }
            if (includeSecurityEvents) {
                predicates.add(cb.or(cb.equal(root.get("category"), "DOCUMENT"), cb.equal(root.get("category"), "DRM")));
            } else {
                predicates.add(cb.equal(root.get("category"), "DOCUMENT"));
            }
            query.orderBy(cb.desc(root.get("timestamp")));
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private Specification<AuditLog> buildSearchSpecificationForTraceback(
            Long documentId, String accountId, String payloadHash, boolean includeSecurityEvents) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (documentId != null) {
                String docIdPatternNew = "#" + documentId;
                String docIdPatternOld = "DocID:" + documentId;
                predicates.add(cb.or(
                        cb.like(cb.function("LOWER", String.class, cb.lower(root.get("details"))), "%" + docIdPatternNew.toLowerCase() + "%"),
                        cb.like(cb.function("LOWER", String.class, cb.lower(root.get("details"))), "%" + docIdPatternOld.toLowerCase() + "%")));
            }
            if (StringUtils.hasText(accountId)) {
                predicates.add(cb.like(cb.function("LOWER", String.class, cb.lower(root.get("details"))), "%uid:" + accountId.toLowerCase() + "%"));
            }
            if (StringUtils.hasText(payloadHash)) {
                predicates.add(cb.like(cb.function("LOWER", String.class, cb.lower(root.get("details"))), "%" + payloadHash.toLowerCase() + "%"));
            }
            if (includeSecurityEvents) {
                predicates.add(cb.or(cb.equal(root.get("category"), "DOCUMENT"), cb.equal(root.get("category"), "DRM")));
            } else {
                predicates.add(cb.equal(root.get("category"), "DOCUMENT"));
            }
            query.orderBy(cb.desc(root.get("timestamp")));
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
