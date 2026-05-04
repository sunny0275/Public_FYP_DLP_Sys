package com.dlp.platform.controller.document;

import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.dto.document.*;
import com.dlp.platform.entity.User;
import com.dlp.platform.service.document.DocumentService;
import com.dlp.platform.service.document.UploadJobService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.security.NoSuchAlgorithmException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/docs")
@Slf4j
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentService documentService;
    private final UploadJobService uploadJobService;

    /**
     * Upload document
     * POST /api/docs/upload
     */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<UploadJobResponse>> uploadDocument(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "name", required = false) String name,
            @RequestParam(value = "department", required = false) String department,
            @RequestParam(value = "description", required = false) String description,
            @RequestParam(value = "templateType", required = false) String templateType,
            @RequestParam(value = "templateDataJson", required = false) String templateDataJson,
            @RequestParam(value = "classificationLevel", required = false) String classificationLevel,
            @RequestParam(value = "tags", required = false) String[] tags,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest request) {

        try {
            log.info("Upload request from user: {} for file: {} (size: {} bytes, type: {})",
                currentUser != null ? currentUser.getAccountId() : "null", 
                file != null ? file.getOriginalFilename() : "unknown",
                file != null ? file.getSize() : 0,
                file != null ? file.getContentType() : "null");

            if (currentUser == null) {
                log.error("Current user is null in upload endpoint");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("User not authenticated"));
            }

            if (file == null || file.isEmpty()) {
                log.error("File is null or empty");
                return ResponseEntity.badRequest()
                    .body(ApiResponse.error("File is required"));
            }

            String resolvedDepartment = (currentUser.getDepartment() != null && !currentUser.getDepartment().isBlank())
                ? currentUser.getDepartment()
                : department;

            if (resolvedDepartment == null || resolvedDepartment.isBlank()) {
                return ResponseEntity.badRequest().body(ApiResponse.error("Department is required"));
            }

            if (classificationLevel == null || classificationLevel.isBlank()) {
                return ResponseEntity.badRequest().body(ApiResponse.error("Classification level is required"));
            }

            DocumentUploadRequest uploadRequest = DocumentUploadRequest.builder()
                .name(name)
                .description(description)
                .templateType(templateType)
                .templateDataJson(templateDataJson)
                .department(resolvedDepartment)
                .classificationLevel(classificationLevel)
                .tags(tags != null ? java.util.Set.of(tags) : null)
                .build();

            String ipAddress = getClientIpAddress(request);
            UploadJobResponse jobResponse = uploadJobService.createUploadJob(
                file, uploadRequest, currentUser, ipAddress
            );

            return ResponseEntity.ok(ApiResponse.success(
                "File upload started successfully. Job ID: " + jobResponse.getId(),
                jobResponse
            ));

        } catch (IOException | NoSuchAlgorithmException e) {
            log.error("Error uploading file", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("File upload failed: " + e.getMessage()));
        } catch (IllegalArgumentException e) {
            log.error("Invalid upload request", e);
            return ResponseEntity.badRequest()
                .body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("Unexpected error during file upload", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("File upload failed: " + e.getMessage()));
        }
    }

    /**
     * Get upload job status
     * GET /api/docs/jobs/{jobId}
     */
    @GetMapping("/jobs/{jobId}")
    public ResponseEntity<ApiResponse<UploadJobResponse>> getJobStatus(
            @PathVariable Long jobId,
            @AuthenticationPrincipal User currentUser) {
        try {
            UploadJobResponse jobResponse = uploadJobService.getJobStatus(jobId, currentUser);
            return ResponseEntity.ok(ApiResponse.success("Job status retrieved", jobResponse));
        } catch (RuntimeException e) {
            log.error("Error retrieving job status", e);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("Job not found"));
        }
        // Note: AccessDeniedException propagates to GlobalExceptionHandler for audit logging
    }

    /**
     * Resolve upload classification mismatch (REVIEW_REQUIRED) by selecting final level.
     * POST /api/docs/jobs/{jobId}/resolve-classification
     */
    @PostMapping("/jobs/{jobId}/resolve-classification")
    public ResponseEntity<ApiResponse<UploadJobResponse>> resolveUploadClassification(
            @PathVariable Long jobId,
            @Valid @RequestBody ResolveUploadClassificationRequest requestBody,
            @AuthenticationPrincipal User currentUser) {
        try {
            UploadJobResponse updated = uploadJobService.resolveUploadClassification(jobId, currentUser, requestBody);
            return ResponseEntity.ok(ApiResponse.success("Upload classification resolved", updated));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("Error resolving upload classification", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to resolve upload classification"));
        }
        // Note: AccessDeniedException propagates to GlobalExceptionHandler for audit logging
    }

    /**
     * Get user's active jobs
     * GET /api/docs/jobs/active
     */
    @GetMapping("/jobs/active")
    public ResponseEntity<ApiResponse<List<UploadJobResponse>>> getActiveJobs(
            @AuthenticationPrincipal User currentUser) {
        List<UploadJobResponse> jobs = uploadJobService.getUserActiveJobs(currentUser);
        return ResponseEntity.ok(ApiResponse.success("Active jobs retrieved", jobs));
    }

    /**
     * POST /api/docs/{id}/generate-summary
     * Generate minimal-disclosure summary for a document.
     */
    @PostMapping("/{id}/generate-summary")
    public ResponseEntity<ApiResponse<Map<String, Object>>> generateSummary(
            @PathVariable Long id,
            @RequestParam(defaultValue = "500") Integer maxChars,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest request) {
        try {
            Map<String, Object> summary = documentService.generateSafeSummary(
                id,
                currentUser,
                getClientIpAddress(request),
                maxChars != null ? maxChars : 500
            );
            return ResponseEntity.ok(ApiResponse.success("Document summary generated", summary));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error("Document not found"));
        } catch (Exception e) {
            log.error("Failed to generate document summary", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to generate summary: " + e.getMessage()));
        }
        // Note: AccessDeniedException propagates to GlobalExceptionHandler for audit logging
    }

    /**
     * POST /api/docs/{id}/re-encrypt
     * Force document re-encryption.
     */
    @PostMapping("/{id}/re-encrypt")
    public ResponseEntity<ApiResponse<Map<String, Object>>> reEncryptDocument(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest request) {
        try {
            Map<String, Object> result = documentService.reEncryptDocument(id, currentUser, getClientIpAddress(request));
            return ResponseEntity.ok(ApiResponse.success("Document re-encrypted", result));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error("Document not found"));
        } catch (Exception e) {
            log.error("Failed to re-encrypt document {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to re-encrypt document: " + e.getMessage()));
        }
        // Note: AccessDeniedException propagates to GlobalExceptionHandler for audit logging
    }

    /**
     * POST /api/docs/batch-re-encrypt
     * Batch re-encrypt selected documents.
     */
    @PostMapping("/batch-re-encrypt")
    public ResponseEntity<ApiResponse<Map<String, Object>>> batchReEncryptDocuments(
            @RequestBody Map<String, List<Long>> body,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest request) {
        try {
            List<?> rawIds = body != null ? body.getOrDefault("documentIds", List.of()) : List.of();
            List<Long> documentIds = rawIds.stream()
                .filter(java.util.Objects::nonNull)
                .map(v -> {
                    if (v instanceof Number n) {
                        return n.longValue();
                    }
                    try {
                        return Long.parseLong(String.valueOf(v));
                    } catch (Exception e) {
                        throw new IllegalArgumentException("Invalid documentId value: " + v);
                    }
                })
                .toList();
            if (documentIds.isEmpty()) {
                return ResponseEntity.badRequest().body(ApiResponse.error("documentIds is required"));
            }
            Map<String, Object> result = documentService.batchReEncryptDocuments(documentIds, currentUser, getClientIpAddress(request));
            return ResponseEntity.ok(ApiResponse.success("Batch re-encryption completed", result));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to batch re-encrypt documents", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to batch re-encrypt: " + e.getMessage()));
        }
    }

    /**
     * Search and filter documents
     * GET /api/docs?query=...&department=...
     */
    @GetMapping
    public ResponseEntity<ApiResponse<Page<DocumentResponse>>> searchDocuments(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String classificationLevel,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String[] tags,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(defaultValue = "updatedAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortOrder,
            @RequestParam(defaultValue = "0") Integer page,
            @RequestParam(defaultValue = "20") Integer pageSize,
            @AuthenticationPrincipal User currentUser) {

        try {
            log.info("Search documents request - User: {}, Query: {}, Department: {}, Level: {}, Status: {}, Page: {}, PageSize: {}", 
                currentUser != null ? currentUser.getAccountId() : "null",
                query, department, classificationLevel, status, page, pageSize);

            if (currentUser == null) {
                log.error("Current user is null in searchDocuments endpoint");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("User not authenticated"));
            }

            // Parse date range parameters (support both full ISO datetime and simple yyyy-MM-dd)
            java.time.LocalDateTime parsedStartDate = parseDateTime(startDate, false);
            java.time.LocalDateTime parsedEndDate = parseDateTime(endDate, true);

            DocumentSearchRequest searchRequest = DocumentSearchRequest.builder()
                .query(query)
                .department(department)
                .classificationLevel(classificationLevel)
                .status(status)
                .tags(tags)
                .startDate(parsedStartDate)
                .endDate(parsedEndDate)
                .sortBy(sortBy)
                .sortOrder(sortOrder)
                .page(page)
                .pageSize(pageSize)
                .build();

            log.debug("Search request built: {}", searchRequest);

            Page<DocumentResponse> documents = documentService.searchDocuments(searchRequest, currentUser);
            
            log.info("Search completed successfully - Found {} documents (page {} of {})", 
                documents.getTotalElements(), documents.getNumber() + 1, documents.getTotalPages());
            
            return ResponseEntity.ok(ApiResponse.success("Documents retrieved", documents));
            
        } catch (IllegalArgumentException e) {
            log.error("Invalid search parameters", e);
            return ResponseEntity.badRequest()
                .body(ApiResponse.error("Invalid search parameters: " + e.getMessage()));
        } catch (Exception e) {
            log.error("Error searching documents - User: {}, Query: {}, Department: {}", 
                currentUser != null ? currentUser.getAccountId() : "null", query, department, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to search documents: " + e.getMessage()));
        }
    }

    /**
     * Parse date/datetime parameter from request.
     * Supports:
     * - ISO_DATE_TIME: 2025-12-24T10:15:30
     * - ISO_DATE (date only): 2025-12-24 (converted to start/end of day)
     */
    private java.time.LocalDateTime parseDateTime(String value, boolean endOfDay) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            if (value.contains("T")) {
                // Full ISO datetime from quick filters
                return java.time.LocalDateTime.parse(value);
            } else {
                // Date-only from custom range (HTML date input)
                java.time.LocalDate date = java.time.LocalDate.parse(value);
                return endOfDay
                    ? date.atTime(23, 59, 59)
                    : date.atStartOfDay();
            }
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid date format: " + value);
        }
    }

    /**
     * Batch export documents
     * POST /api/docs/batch/export
     */
    @PostMapping("/batch/export")
    public ResponseEntity<ApiResponse<Map<String, Object>>> batchExportDocuments(
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest httpRequest) {
        try {
            @SuppressWarnings("unchecked")
            List<Long> documentIds = (List<Long>) request.get("documentIds");
            if (documentIds == null || documentIds.isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(ApiResponse.error("No documents selected for export"));
            }

            String ipAddress = httpRequest.getRemoteAddr();
            Map<String, Object> result = documentService.batchExportDocuments(documentIds, currentUser, ipAddress);
            
            // Return download URL for the ZIP file
            if (result.containsKey("exportFilePath")) {
                String filePath = (String) result.get("exportFilePath");
                result.put("downloadUrl", "/api/docs/batch/export/download?file=" + 
                    java.net.URLEncoder.encode(filePath, java.nio.charset.StandardCharsets.UTF_8));
            }
            
            return ResponseEntity.ok(ApiResponse.success("Batch export completed", result));
        } catch (Exception e) {
            log.error("Error in batch export", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Batch export failed: " + e.getMessage()));
        }
        // Note: AccessDeniedException propagates to GlobalExceptionHandler for audit logging
    }

    /**
     * Download batch export ZIP file — DISABLED.
     * Batch exports are not permitted as they would bypass per-document watermarking.
     * Users must view/export documents individually via the preview endpoint.
     * GET /api/docs/batch/export/download
     */
    @GetMapping("/batch/export/download")
    public ResponseEntity<ApiResponse<Void>> downloadBatchExport(
            @RequestParam String file,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest request) {
        log.warn("Batch export download attempt blocked for file {} by user {} — downloads disabled",
            file, currentUser != null ? currentUser.getAccountId() : "UNKNOWN");
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(ApiResponse.error("Batch export download is not permitted. Please preview documents individually."));
    }

    /**
     * Batch share documents
     * POST /api/docs/batch/share
     */
    @PostMapping("/batch/share")
    public ResponseEntity<ApiResponse<Map<String, Object>>> batchShareDocuments(
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest httpRequest) {
        try {
            @SuppressWarnings("unchecked")
            List<Long> documentIds = (List<Long>) request.get("documentIds");
            String shareType = (String) request.get("shareType");
            @SuppressWarnings("unchecked")
            List<String> recipients = (List<String>) request.get("recipients");
            String permissions = (String) request.get("permissions");
            String expireAt = (String) request.get("expireAt");

            if (documentIds == null || documentIds.isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(ApiResponse.error("No documents selected for sharing"));
            }

            String ipAddress = httpRequest.getRemoteAddr();
            Map<String, Object> result = documentService.batchShareDocuments(
                documentIds, shareType, recipients, permissions, expireAt, currentUser, ipAddress);
            return ResponseEntity.ok(ApiResponse.success("Batch share validation completed", result));
        } catch (Exception e) {
            log.error("Error in batch share", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Batch share failed: " + e.getMessage()));
        }
        // Note: AccessDeniedException propagates to GlobalExceptionHandler for audit logging
    }

    /**
     * Get document by ID
     * GET /api/docs/{id}
     * Note: AccessDeniedException propagates to GlobalExceptionHandler for audit logging
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<DocumentResponse>> getDocument(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest request) {
        try {
            String ipAddress = getClientIpAddress(request);
            DocumentResponse document = documentService.getDocument(id, currentUser, ipAddress);
            return ResponseEntity.ok(ApiResponse.success("Document retrieved", document));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("Document not found"));
        }
        // Note: AccessDeniedException is NOT caught here - it propagates to GlobalExceptionHandler
        // which handles audit logging and UEBA score deduction
    }

    /**
     * Record VIEW when user explicitly clicks Preview tab.
     * Only logs VIEW audit when user intentionally views the document content.
     * POST /api/docs/{id}/view
     */
    @PostMapping("/{id}/view")
    public ResponseEntity<ApiResponse<Void>> recordDocumentView(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest request) {
        try {
            String ipAddress = getClientIpAddress(request);
            documentService.recordView(id, currentUser, ipAddress);
            return ResponseEntity.ok(ApiResponse.success("View recorded", null));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("Document not found"));
        }
        // Note: AccessDeniedException propagates to GlobalExceptionHandler
    }

    /**
     * Get recent documents for dashboard
     * GET /api/docs/recent
     */
    @GetMapping("/recent")
    public ResponseEntity<ApiResponse<List<DocumentResponse>>> getRecentDocuments(
            @RequestParam(defaultValue = "10") Integer limit,
            @AuthenticationPrincipal User currentUser) {
        List<DocumentResponse> documents = documentService.getRecentDocuments(currentUser, limit);
        return ResponseEntity.ok(ApiResponse.success("Recent documents retrieved", documents));
    }

    /**
     * Update document metadata
     * PUT /api/docs/{id}
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<DocumentResponse>> updateDocument(
            @PathVariable Long id,
            @Valid @RequestBody DocumentUploadRequest request,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest httpRequest) {
        try {
            String ipAddress = httpRequest.getRemoteAddr();
            DocumentResponse document = documentService.updateDocument(id, request, currentUser, ipAddress);
            return ResponseEntity.ok(ApiResponse.success("Document updated successfully", document));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("Document not found"));
        }
        // Note: AccessDeniedException propagates to GlobalExceptionHandler for audit logging
    }

    /**
     * Download document — DISABLED.
     * Raw file download is not permitted. Documents must be viewed only (preview endpoint
     * applies per-viewer watermarks for audit traceability). This prevents uncontrolled
     * data exfiltration while preserving visibility into who accessed what via the watermark.
     * GET /api/docs/{id}/download
     */
    @GetMapping("/{id}/download")
    public ResponseEntity<ApiResponse<Void>> downloadDocument(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest request) {
        log.warn("Download attempt blocked for document {} by user {} — downloads disabled",
            id, currentUser != null ? currentUser.getAccountId() : "UNKNOWN");
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(ApiResponse.error("Download is not permitted. Please use the preview function to view the document."));
    }

    /**
     * Get canonical SHA-256 hash for signing based on raw stored bytes (no watermark/encryption).
     * GET /api/docs/{id}/hash
     */
    @GetMapping("/{id}/hash")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getDocumentHash(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest request) {
        try {
            String ipAddress = getClientIpAddress(request);
            String hash = documentService.getDocumentContentHash(id, currentUser, ipAddress);
            Map<String, Object> data = new java.util.HashMap<>();
            data.put("documentId", id);
            data.put("algorithm", "SHA-256");
            data.put("hash", hash);
            data.put("source", "raw");
            return ResponseEntity.ok(ApiResponse.success("Document hash retrieved", data));
        } catch (IOException e) {
            log.error("Error computing document hash", e);
            if (e.getMessage() != null && e.getMessage().contains("File not found")) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error("Document content file is missing. Please re-upload the document."));
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to compute document hash: " + e.getMessage()));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("Document not found"));
        }
        // Note: AccessDeniedException propagates to GlobalExceptionHandler for audit logging
    }

    /**
     * Get all tags
     * GET /api/docs/tags
     */
    @GetMapping("/tags")
    public ResponseEntity<ApiResponse<List<TagResponse>>> getAllTags() {
        List<TagResponse> tags = documentService.getAllTags();
        return ResponseEntity.ok(ApiResponse.success("Tags retrieved", tags));
    }

    /**
     * Get documents requiring review
     * GET /api/docs/review
     */
    @GetMapping("/review")
    public ResponseEntity<ApiResponse<Page<DocumentResponse>>> getDocumentsRequiringReview(
            @RequestParam(defaultValue = "0") Integer page,
            @RequestParam(defaultValue = "20") Integer pageSize) {
        Page<DocumentResponse> documents = documentService.getDocumentsRequiringReview(page, pageSize);
        return ResponseEntity.ok(ApiResponse.success("Documents requiring review retrieved", documents));
    }

    /**
     * Get document content for preview (with watermark)
     * GET /api/docs/{id}/content
     */
    @GetMapping("/{id}/content")
    public ResponseEntity<?> getDocumentContent(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest request) {
        try {
            String ipAddress = getClientIpAddress(request);

            // Get document content with watermark applied
            DocumentService.PreviewResult result = documentService.getDocumentContentForPreview(id, currentUser, ipAddress);

            // Get file type from preview result (avoid duplicate DB query)
            String contentType = result.getFileType();
            if (contentType == null || contentType.isEmpty()) {
                contentType = "application/pdf";
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(contentType));
            headers.setCacheControl("no-cache, no-store, must-revalidate");
            headers.setPragma("no-cache");
            headers.setExpires(0);
            headers.set("X-Frame-Options", "SAMEORIGIN");
            // Pass watermark metadata so the frontend footer shows consistent IP + short code
            if (result.getShortCode() != null) {
                headers.set("X-Watermark-Code", result.getShortCode());
            }
            if (result.getAppliedIp() != null) {
                headers.set("X-Viewer-IP", result.getAppliedIp());
            }

            return ResponseEntity.ok()
                .headers(headers)
                .body(result.getContent());

        } catch (IOException e) {
            log.error("Error getting document content for document ID {}: {}", id, e.getMessage(), e);
            // Check if it's a file not found error
            if (e.getMessage() != null && e.getMessage().contains("File not found")) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error("Document file not found. The file may have been deleted or moved."));
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to get document content: " + e.getMessage()));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("Document not found"));
        }
        // Note: AccessDeniedException is NOT caught here - it propagates to GlobalExceptionHandler
        // which handles audit logging and UEBA score deduction
    }

    /**
     * Get document version history
     * GET /api/docs/{id}/versions
     */
    @GetMapping("/{id}/versions")
    public ResponseEntity<ApiResponse<List<DocumentVersionResponse>>> getDocumentVersions(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest request) {
        try {
            String ipAddress = getClientIpAddress(request);
            List<DocumentVersionResponse> versions = documentService.getDocumentVersions(id, currentUser, ipAddress);
            return ResponseEntity.ok(ApiResponse.success("Version history retrieved", versions));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("Document not found"));
        }
        // Note: AccessDeniedException propagates to GlobalExceptionHandler
    }

    /**
     * Get document activity log
     * GET /api/docs/{id}/activity
     */
    @GetMapping("/{id}/activity")
    public ResponseEntity<ApiResponse<List<DocumentActivityResponse>>> getDocumentActivity(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest request) {
        try {
            String ipAddress = getClientIpAddress(request);
            List<DocumentActivityResponse> activities = documentService.getDocumentActivity(id, currentUser, ipAddress);
            return ResponseEntity.ok(ApiResponse.success("Activity log retrieved", activities));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("Document not found"));
        }
        // Note: AccessDeniedException propagates to GlobalExceptionHandler
    }

    /**
     * Restore document to a specific version
     * POST /api/docs/{id}/versions/{versionId}/restore
     */
    @PostMapping("/{id}/versions/{versionId}/restore")
    public ResponseEntity<ApiResponse<DocumentResponse>> restoreVersion(
            @PathVariable Long id,
            @PathVariable Long versionId,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest request) {
        try {
            String ipAddress = getClientIpAddress(request);
            DocumentResponse document = documentService.restoreDocumentVersion(id, versionId, currentUser, ipAddress);
            return ResponseEntity.ok(ApiResponse.success("Document restored to version successfully", document));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error(e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                .body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("Error restoring document version", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to restore version: " + e.getMessage()));
        }
        // Note: AccessDeniedException propagates to GlobalExceptionHandler for audit logging
    }

    /**
     * Compare two document versions
     * GET /api/docs/{id}/versions/compare?version1={id}&version2={id}
     */
    @GetMapping("/{id}/versions/compare")
    public ResponseEntity<ApiResponse<Map<String, Object>>> compareVersions(
            @PathVariable Long id,
            @RequestParam Long version1,
            @RequestParam Long version2,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest request) {
        try {
            String ipAddress = getClientIpAddress(request);
            Map<String, Object> comparison = documentService.compareDocumentVersions(id, version1, version2, currentUser, ipAddress);
            return ResponseEntity.ok(ApiResponse.success("Version comparison retrieved", comparison));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error(e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                .body(ApiResponse.error(e.getMessage()));
        }
        // Note: AccessDeniedException propagates to GlobalExceptionHandler for audit logging
    }


    /**
     * Download a specific document version — DISABLED.
     * Version downloads are blocked for the same reason as main document downloads:
     * raw file access is not permitted. Use preview to view version content with
     * per-viewer watermark for audit traceability.
     * GET /api/docs/{id}/versions/{versionId}/download
     */
    @GetMapping("/{id}/versions/{versionId}/download")
    public ResponseEntity<ApiResponse<Void>> downloadVersion(
            @PathVariable Long id,
            @PathVariable Long versionId,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest request) {
        log.warn("Version download attempt blocked for document {} version {} by user {} — downloads disabled",
            id, versionId, currentUser != null ? currentUser.getAccountId() : "UNKNOWN");
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(ApiResponse.error("Download is not permitted. Please use the preview function to view the document."));
    }

    /**
     * Get client IP address, checking X-Forwarded-For header first
     */
    private String getClientIpAddress(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isEmpty() && !"unknown".equalsIgnoreCase(xff)) {
            if (xff.contains(",")) {
                xff = xff.split(",")[0].trim();
            }
            return xff;
        }
        return request.getRemoteAddr();
    }
}
