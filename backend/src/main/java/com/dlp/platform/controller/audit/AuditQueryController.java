package com.dlp.platform.controller.audit;

import com.dlp.platform.dto.audit.AuditLogSearchCriteria;
import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.repository.AuditLogRepository;
import com.dlp.platform.service.audit.AuditExportService;
import com.dlp.platform.service.audit.AuditService;
import com.dlp.platform.service.dashboard.SecurityAnalyticsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Lightweight read-only audit endpoints for dashboard widgets.
 *
 * `/api/audit/recent` returns a compact list of recent AuditLog entries for Security / Compliance dashboards.
 */
@Slf4j
@RestController
@RequestMapping("/audit")
@RequiredArgsConstructor
public class AuditQueryController {

    private final SecurityAnalyticsService securityAnalyticsService;
    private final AuditLogRepository auditLogRepository;
    private final AuditExportService auditExportService;
    private final AuditService auditService;

    @Value("${dlp.audit.allow-destructive-ops:false}")
    private boolean allowDestructiveAuditOps;

    /**
     * GET /api/audit/recent
     *
     * Most recent audit events (up to 50), including action/result/IP/timestamp fields.
     */
    @GetMapping("/recent")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getRecentAuditEvents() {
        log.debug("Recent audit events requested");

        List<Map<String, Object>> events = securityAnalyticsService.getRecentAuditEvents();

        return ResponseEntity.ok(
                ApiResponse.success("Recent audit events fetched successfully", events)
        );
    }

    @GetMapping("/logs")
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER') or hasRole('REVIEWER')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> searchAuditLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String userName,
            @RequestParam(required = false) String accountId,
            @RequestParam(required = false) String searchTerm,
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) String startTime,
            @RequestParam(required = false) String endTime,
            @RequestParam(required = false) Long documentId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String result
    ) {
        log.debug("Audit logs requested (page: {}, size: {})", page, size);

        try {
            boolean admin = isAdmin();
            if (!admin && isBlockchainOnlyQuery(searchTerm, action)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(ApiResponse.error("Only ADMIN can view blockchain-focused audit logs"));
            }

            var pageable = org.springframework.data.domain.PageRequest.of(
                    page,
                    size,
                    Sort.by(Sort.Direction.DESC, "timestamp")
            );

            AuditLogSearchCriteria criteria = AuditLogSearchCriteria.builder()
                    .userId(userId)
                    .userName(userName)
                    .accountId(accountId)
                    .searchTerm(searchTerm)
                    .severity(severity)
                    .startTime(parseTimestamp(startTime))
                    .endTime(parseTimestamp(endTime))
                    .documentId(documentId)
                    .action(action)
                    .category(category)
                    .result(result)
                    .build();

            Page<Map<String, Object>> logPage = securityAnalyticsService.searchAuditLogs(criteria, pageable);
            if (!admin) {
                scrubBlockchainFields(logPage.getContent());
            }

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("items", logPage.getContent());
            response.put("totalElements", logPage.getTotalElements());
            response.put("totalPages", logPage.getTotalPages());
            response.put("currentPage", logPage.getNumber());
            response.put("pageSize", logPage.getSize());

            return ResponseEntity.ok(ApiResponse.success("Audit logs retrieved", response));
        } catch (IllegalArgumentException | DateTimeParseException ex) {
            log.error("Invalid audit log query", ex);
            return ResponseEntity.badRequest().body(ApiResponse.error("Invalid audit log query", ex.getMessage()));
        } catch (Exception ex) {
            log.error("Failed to search audit logs", ex);
            return ResponseEntity.badRequest().body(ApiResponse.error("Failed to search audit logs", ex.getMessage()));
        }
    }

    /**
     * DELETE /api/audit/clear
     *
     * Clear the AuditLog table (for testing/reset in non-production environments).
     */
    @DeleteMapping("/clear")
    public ResponseEntity<ApiResponse<Void>> clearAuditEvents() {
        if (!allowDestructiveAuditOps) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.error("Destructive audit operations are disabled"));
        }
        auditLogRepository.deleteAll();
        log.info("Audit log store cleared via /api/audit/clear");
        return ResponseEntity.ok(ApiResponse.success("Audit logs cleared", null));
    }

    /**
     * GET /api/audit/legacy-count
     * Count audit logs that are not part of the hash chain (immutableHash is null).
     */
    @GetMapping("/legacy-count")
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER') or hasRole('REVIEWER')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getLegacyAuditCount() {
        long count = auditLogRepository.countByImmutableHashIsNull();
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("legacyCount", count);
        return ResponseEntity.ok(ApiResponse.success("Legacy (unchained) audit log count", data));
    }

    /**
     * POST /api/audit/mark-legacy-not-chained
     * Mark all old (unchained) audit logs with anchorStatus = NOT_CHAINED so they are distinguishable.
     */
    @PostMapping("/mark-legacy-not-chained")
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER') or hasRole('REVIEWER')")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, Object>>> markLegacyAsNotChained() {
        int updated = auditLogRepository.markUnchainedAsNotChained();
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("markedCount", updated);
        log.info("Marked {} legacy audit logs as NOT_CHAINED", updated);
        return ResponseEntity.ok(ApiResponse.success("Legacy logs marked as NOT_CHAINED", data));
    }

    /**
     * DELETE /api/audit/clear-legacy
     * Delete only audit logs that are not part of the hash chain (immutableHash is null).
     */
    @DeleteMapping("/clear-legacy")
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER') or hasRole('REVIEWER')")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, Object>>> clearLegacyAuditLogs() {
        if (!allowDestructiveAuditOps) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.error("Destructive audit operations are disabled"));
        }
        int deleted = auditLogRepository.deleteUnchainedLogs();
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("deletedCount", deleted);
        log.info("Deleted {} legacy (unchained) audit logs", deleted);
        return ResponseEntity.ok(ApiResponse.success("Legacy audit logs cleared", data));
    }

    /**
     * Export audit logs as CSV with signature
     * GET /audit/exports?format=csv&...
     */
    @GetMapping("/exports")
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER') or hasRole('REVIEWER')")
    public ResponseEntity<?> exportAuditLogs(
            @RequestParam(defaultValue = "csv") String format,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String userName,
            @RequestParam(required = false) String accountId,
            @RequestParam(required = false) String searchTerm,
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) String startTime,
            @RequestParam(required = false) String endTime,
            @RequestParam(required = false) Long documentId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String result,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "1000") int size
    ) {
        try {
            AuditLogSearchCriteria criteria = AuditLogSearchCriteria.builder()
                    .userId(userId)
                    .userName(userName)
                    .accountId(accountId)
                    .searchTerm(searchTerm)
                    .severity(severity)
                    .startTime(parseTimestamp(startTime))
                    .endTime(parseTimestamp(endTime))
                    .documentId(documentId)
                    .action(action)
                    .category(category)
                    .result(result)
                    .build();

            Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "timestamp"));

            if ("csv".equalsIgnoreCase(format)) {
                byte[] csvContent = auditExportService.exportAsCsv(criteria, pageable);
                Map<String, Object> metadata = auditExportService.buildExportMetadata(csvContent, "CSV");

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.TEXT_PLAIN);
                headers.setContentDispositionFormData("attachment", 
                    "audit-logs-" + LocalDateTime.now().format(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE_TIME) + ".csv");
                headers.set("X-Report-Hash", metadata.get("hash").toString());
                headers.set("X-Report-Algorithm", metadata.get("hashAlgorithm").toString());

                return ResponseEntity.ok()
                        .headers(headers)
                        .body(csvContent);
            } else {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("Unsupported export format: " + format + ". Supported: csv"));
            }
        } catch (Exception e) {
            log.error("Failed to export audit logs", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("Failed to export audit logs: " + e.getMessage()));
        }
    }

    /**
     * POST /api/audit/verify-chain
     *
     * Verify hash-chain continuity and blockchain anchoring integrity for audit logs.
     * By default verifies on-chain tx input hash as well.
     */
    @PostMapping("/verify-chain")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> verifyChain(
            @RequestParam(name = "verifyOnChain", defaultValue = "true") boolean verifyOnChain,
            @RequestParam(name = "maxViolations", defaultValue = "200") int maxViolations
    ) {
        try {
            Map<String, Object> data = auditService.verifyChain(verifyOnChain, maxViolations);
            boolean ok = Boolean.TRUE.equals(data.get("ok"));
            if (ok) {
                return ResponseEntity.ok(ApiResponse.success("Audit chain verification passed", data));
            }
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(ApiResponse.success("Audit chain verification found inconsistencies", data));
        } catch (Exception e) {
            log.error("Failed to verify audit chain", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("Failed to verify audit chain: " + e.getMessage()));
        }
    }

    private LocalDateTime parseTimestamp(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        try {
            return LocalDateTime.parse(value);
        } catch (DateTimeParseException ex) {
            Instant instant = Instant.parse(value);
            return LocalDateTime.ofInstant(instant, ZoneId.of("UTC"));
        }
    }

    private boolean isAdmin() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getAuthorities() == null) {
            return false;
        }
        for (GrantedAuthority authority : authentication.getAuthorities()) {
            if ("ROLE_ADMIN".equalsIgnoreCase(authority.getAuthority())) {
                return true;
            }
        }
        return false;
    }

    private boolean isBlockchainOnlyQuery(String searchTerm, String action) {
        if (StringUtils.hasText(searchTerm) && "BLOCKCHAIN".equalsIgnoreCase(searchTerm.trim())) {
            return true;
        }
        return StringUtils.hasText(action) && action.trim().toUpperCase().contains("BLOCKCHAIN");
    }

    private void scrubBlockchainFields(List<Map<String, Object>> items) {
        if (items == null) return;
        for (Map<String, Object> item : items) {
            if (item == null) continue;
            item.remove("immutableHash");
            item.remove("blockchainTxHash");
            item.remove("anchorStatus");
            item.remove("anchoredAt");
        }
    }
}



