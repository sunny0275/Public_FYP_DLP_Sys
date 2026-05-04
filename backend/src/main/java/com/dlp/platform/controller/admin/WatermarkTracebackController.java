package com.dlp.platform.controller.admin;

import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.service.document.WatermarkTracebackService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.Map;

/**
 * REST controller for watermark-based audit log traceback.
 * 
 * Provides endpoints for:
 * - Searching audit logs by watermark metadata (userId, documentId, timestamp)
 * - Traceback by decoded short code from deep watermark
 * 
 * Access restricted to ADMIN role.
 */
@Slf4j
@RestController
@RequestMapping("/admin/watermark-traceback")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class WatermarkTracebackController {

    private final WatermarkTracebackService watermarkTracebackService;

    /**
     * POST /api/admin/watermark-traceback/search
     * 
     * Search audit logs by watermark metadata.
     * All parameters are optional - any combination can be used.
     * More criteria = more precise results.
     * 
     * Watermark format: UID: {accountId} | {startTime} | {ipAddress} | #{documentId}
     * 
     * @param userAccountId User account ID to search for (e.g., "it1", "admin")
     * @param documentId Document ID to search for
     * @param documentName Document name to search for (partial match)
     * @param ipAddress IP address to search for
     * @param shortCode Watermark short code (exact match, highest priority)
     * @param payloadHash Watermark payload hash (exact match)
     * @param startTime Start of time range (ISO format: yyyy-MM-ddTHH:mm:ss)
     * @param endTime End of time range (ISO format: yyyy-MM-ddTHH:mm:ss)
     * @param page Page number (0-based)
     * @param size Page size
     * @return Search results with audit logs and watermark fingerprint info
     */
    @PostMapping("/search")
    public ResponseEntity<ApiResponse<Map<String, Object>>> searchByWatermarkInfo(
            @RequestParam(required = false) String userAccountId,
            @RequestParam(required = false) Long documentId,
            @RequestParam(required = false) String documentName,
            @RequestParam(required = false) String ipAddress,
            @RequestParam(required = false) String shortCode,
            @RequestParam(required = false) String payloadHash,
            @RequestParam(required = false) String startTime,
            @RequestParam(required = false) String endTime,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        log.info("Watermark traceback search request: userAccountId={}, documentId={}, documentName={}, ip={}, shortCode={}, startTime={}, endTime={}",
                userAccountId, documentId, documentName, ipAddress, shortCode, startTime, endTime);

        try {
            LocalDateTime startDateTime = parseTimestamp(startTime);
            LocalDateTime endDateTime = parseTimestamp(endTime);

            Map<String, Object> results = watermarkTracebackService.tracebackByWatermarkInfo(
                    userAccountId,
                    documentId,
                    documentName,
                    ipAddress,
                    shortCode,
                    payloadHash,
                    startDateTime,
                    endDateTime,
                    page,
                    size
            );

            return ResponseEntity.ok(ApiResponse.success("Watermark traceback search completed", results));

        } catch (IllegalArgumentException e) {
            log.warn("Invalid watermark traceback request: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Invalid request", e.getMessage()));
        } catch (DateTimeParseException e) {
            log.warn("Invalid timestamp format: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Invalid timestamp format", 
                            "Please use ISO format: yyyy-MM-ddTHH:mm:ss (e.g., 2026-03-29T10:00:00)"));
        } catch (Exception e) {
            log.error("Watermark traceback search failed", e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("Search failed", e.getMessage()));
        }
    }

    /**
     * POST /api/admin/watermark-traceback/shortcode
     * 
     * Traceback by decoded short code from deep watermark.
     * Used when admin extracts a short code from a leaked document.
     * 
     * @param shortCode The decoded short code from watermark extraction
     * @param page Page number (0-based)
     * @param size Page size
     * @return Fingerprint info and related audit logs
     */
    @PostMapping("/shortcode")
    public ResponseEntity<ApiResponse<Map<String, Object>>> tracebackByShortCode(
            @RequestParam String shortCode,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        log.info("Watermark traceback by shortCode request: {}", shortCode);

        try {
            Map<String, Object> results = watermarkTracebackService.tracebackByShortCode(
                    shortCode,
                    page,
                    size
            );

            return ResponseEntity.ok(ApiResponse.success("Short code traceback completed", results));

        } catch (IllegalArgumentException e) {
            log.warn("Invalid short code traceback request: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Invalid request", e.getMessage()));
        } catch (Exception e) {
            log.error("Short code traceback failed for shortCode={}: {}", shortCode, e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("Traceback failed: " + e.getClass().getSimpleName(), e.getMessage()));
        }
    }

    private LocalDateTime parseTimestamp(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDateTime.parse(value);
        } catch (DateTimeParseException ex) {
            try {
                Instant instant = Instant.parse(value);
                return LocalDateTime.ofInstant(instant, ZoneId.of("UTC"));
            } catch (Exception e) {
                throw new DateTimeParseException("Invalid timestamp format", value, 0);
            }
        }
    }
}
