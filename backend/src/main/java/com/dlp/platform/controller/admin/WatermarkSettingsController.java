package com.dlp.platform.controller.admin;

import com.dlp.platform.dto.admin.WatermarkSettingsDto;
import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.entity.User;
import com.dlp.platform.service.admin.WatermarkSettingsService;
import com.dlp.platform.service.document.MetadataWatermarkService;
import com.dlp.platform.service.document.WatermarkFingerprintService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.LinkedHashMap;
import java.util.Map;
/**
 * Controller for Watermark Settings management
 * Phase 04-C: Admin Settings
 */
@Slf4j
@RestController
@RequestMapping("/admin/watermark")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class WatermarkSettingsController {

    private final WatermarkSettingsService watermarkSettingsService;
    private final MetadataWatermarkService metadataWatermarkService;
    private final WatermarkFingerprintService watermarkFingerprintService;

    /**
     * GET /api/admin/watermark
     * Get watermark settings
     */
    @GetMapping
    public ResponseEntity<ApiResponse<WatermarkSettingsDto>> getWatermarkSettings() {
        try {
            WatermarkSettingsDto settings = watermarkSettingsService.getWatermarkSettings();
            return ResponseEntity.ok(ApiResponse.success("Watermark settings retrieved", settings));
        } catch (Exception e) {
            log.error("Failed to retrieve watermark settings", e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("Failed to retrieve watermark settings: " + e.getMessage()));
        }
    }

    /**
     * PUT /api/admin/watermark
     * Update watermark settings
     */
    @PutMapping
    public ResponseEntity<ApiResponse<WatermarkSettingsDto>> updateWatermarkSettings(
            @Valid @RequestBody WatermarkSettingsDto settings,
            @RequestParam(required = false) String reason,
            @AuthenticationPrincipal User currentUser
    ) {
        try {
            String changedBy = currentUser != null ? currentUser.getAccountId() : "SYSTEM";
            String changeReason = reason != null ? reason : "Watermark settings updated";
            
            WatermarkSettingsDto updated = watermarkSettingsService.updateWatermarkSettings(
                    settings, changedBy, changeReason
            );
            return ResponseEntity.ok(ApiResponse.success("Watermark settings updated successfully", updated));
        } catch (Exception e) {
            log.error("Failed to update watermark settings", e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("Failed to update watermark settings: " + e.getMessage()));
        }
    }

    /**
     * POST /api/admin/watermark/check
     *
     * Admin forensic helper: upload a PDF or image.
     * - PDF: DLP metadata extraction.
     * - Image: metadata only (deep watermark removed).
     */
    @PostMapping("/check")
    public ResponseEntity<ApiResponse<Map<String, Object>>> checkBlindWatermark(
            @RequestParam("file") MultipartFile file
    ) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest()
                .body(ApiResponse.error("File is required for watermark check"));
        }

        try {
            String originalFilename = file.getOriginalFilename();
            String contentType = file.getContentType();
            byte[] bytes = file.getBytes();

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("fileName", originalFilename);
            result.put("contentType", contentType);

            boolean isPdf = (contentType != null && contentType.equalsIgnoreCase("application/pdf")) ||
                    (originalFilename != null && originalFilename.toLowerCase().endsWith(".pdf"));
            boolean isImage = (contentType != null && contentType.toLowerCase().startsWith("image/"));

            if (isPdf) {
                result.put("detectedType", "PDF");

                boolean hasMetadata = metadataWatermarkService.hasDLPMetadata(bytes);
                var metadata = metadataWatermarkService.extractMetadataWatermark(bytes);

                result.put("hasDlpMetadata", hasMetadata);
                if (metadata != null) {
                    Map<String, Object> metaMap = new LinkedHashMap<>();
                    metaMap.put("guid", metadata.getGuid());
                    metaMap.put("userId", metadata.getUserId());
                    metaMap.put("timestamp", metadata.getTimestamp());
                    metaMap.put("documentId", metadata.getDocumentId());
                    result.put("metadata", metaMap);
                } else {
                    result.put("metadata", null);
                }

                fillDeepWatermarkResult(result);
            } else if (isImage) {
                result.put("detectedType", "IMAGE");
                result.put("hasDlpMetadata", false);
                result.put("metadata", null);
                fillDeepWatermarkResult(result);
            } else {
                result.put("detectedType", "UNKNOWN");
            }

            return ResponseEntity.ok(ApiResponse.success("Watermark check completed", result));
        } catch (Exception e) {
            log.error("Failed to check watermark", e);
            return ResponseEntity.internalServerError()
                .body(ApiResponse.error("Failed to check watermark: " + e.getMessage()));
        }
    }

    private void fillDeepWatermarkResult(Map<String, Object> result) {
        result.put("hasDeepWatermark", false);
        result.put("deepWatermarkPayload", null);
        result.put("resolvedFingerprint", null);
        result.put("confidence", noDeepWatermarkConfidence());
    }

    private Map<String, Object> noDeepWatermarkConfidence() {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("score", 0.0);
        c.put("percent", 0);
        c.put("level", "N/A");
        c.put("reason", "Deep watermark not configured.");
        c.put("basis", "NOT_CONFIGURED");
        c.put("matchType", null);
        c.put("distance", null);
        return c;
    }
}
