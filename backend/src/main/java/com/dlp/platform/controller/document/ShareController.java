package com.dlp.platform.controller.document;

import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.dto.share.ShareLinkRequest;
import com.dlp.platform.dto.share.ShareLinkResponse;
import com.dlp.platform.dto.share.RejectShareApprovalRequest;
import com.dlp.platform.dto.share.UpdateShareRecipientsRequest;
import com.dlp.platform.dto.share.UpdateShareRequest;
import com.dlp.platform.entity.ShareLink;
import com.dlp.platform.entity.User;
import com.dlp.platform.service.document.ShareLinkService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST Controller for document sharing operations
 *
 * Endpoints:
 * - POST /api/shares - Create share link
 * - GET /api/shares/{token} - Access shared document
 * - DELETE /api/shares/{id} - Revoke share link
 * - GET /api/shares/my - Get user's shares
 * - GET /api/shares/document/{docId} - Get document shares
 * - POST /api/shares/{id}/approve - Approve pending share
 */
@RestController
@RequestMapping("/shares")
@Slf4j
@RequiredArgsConstructor
public class ShareController {

    private final ShareLinkService shareLinkService;
    private final com.dlp.platform.service.document.DocumentService documentService;
    private final com.dlp.platform.service.document.WatermarkService watermarkService;
    private final com.dlp.platform.service.audit.AuditService auditService;
    private final com.dlp.platform.repository.ShareLinkRepository shareLinkRepository;

    /**
     * Create a new share link
     * POST /api/shares
     */
    @PostMapping
    public ResponseEntity<ApiResponse<ShareLinkResponse>> createShareLink(
            @Valid @RequestBody ShareLinkRequest request,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest httpRequest) {

        try {
            String ipAddress = httpRequest.getRemoteAddr();
            ShareLinkResponse response = shareLinkService.createShareLink(request, currentUser, ipAddress);

            String message = response.getRequiresApproval() ?
                "Share link created and pending approval" :
                "Share link created successfully";

            return ResponseEntity.ok(ApiResponse.success(message, response));

        } catch (org.springframework.security.access.AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(e.getMessage()));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("Error creating share link", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to create share link: " + e.getMessage()));
        }
    }

    /**
     * Access a shared document via token
     * GET /api/shares/{token}
     */
    @GetMapping("/{token}")
    public ResponseEntity<ApiResponse<ShareLinkResponse>> accessShareLink(
            @PathVariable String token,
            @RequestParam(required = false) String password,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest httpRequest) {

        try {
            String ipAddress = httpRequest.getRemoteAddr();
            ShareLinkResponse response = shareLinkService.accessShareLink(token, password, ipAddress, currentUser);

            return ResponseEntity.ok(ApiResponse.success("Access granted", response));

        } catch (org.springframework.security.access.AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(e.getMessage()));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("Share link not found or expired"));
        } catch (Exception e) {
            log.error("Error accessing share link", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to access share link"));
        }
    }

    /**
     * Verify share-link access constraints without consuming access quota.
     * POST /api/shares/{token}/verify
     */
    @PostMapping("/{token}/verify")
    public ResponseEntity<ApiResponse<Map<String, Object>>> verifyShareLink(
            @PathVariable String token,
            @RequestParam(required = false) String password,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest httpRequest) {
        try {
            String ipAddress = httpRequest.getRemoteAddr();
            ShareLinkResponse response = shareLinkService.verifyShareLink(token, password, ipAddress, currentUser);
            Map<String, Object> payload = new java.util.LinkedHashMap<>();
            payload.put("valid", true);
            payload.put("documentId", response.getDocumentId());
            payload.put("documentName", response.getDocumentName());
            payload.put("permission", response.getPermission());
            payload.put("expiresAt", response.getExpiresAt());
            payload.put("allowDownload", response.getAllowDownload());
            return ResponseEntity.ok(ApiResponse.success("Share link verified", payload));
        } catch (org.springframework.security.access.AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(e.getMessage()));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("Share link not found or expired"));
        } catch (Exception e) {
            log.error("Error verifying share link", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to verify share link"));
        }
    }

    /**
     * Revoke a share link
     * DELETE /api/shares/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> revokeShareLink(
            @PathVariable Long id,
            @RequestParam(required = false) String reason,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest httpRequest) {

        try {
            String ipAddress = httpRequest.getRemoteAddr();
            shareLinkService.revokeShareLink(id, currentUser, reason, ipAddress);

            return ResponseEntity.ok(ApiResponse.success("Share link revoked successfully", null));

        } catch (org.springframework.security.access.AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(e.getMessage()));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("Share link not found"));
        } catch (Exception e) {
            log.error("Error revoking share link", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to revoke share link"));
        }
    }

    /**
     * Get user's share links
     * GET /api/shares/my
     */
    @GetMapping("/my")
    public ResponseEntity<ApiResponse<Page<ShareLinkResponse>>> getMyShares(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal User currentUser) {

        try {
            Page<ShareLinkResponse> shares = shareLinkService.getUserShares(currentUser, page, size);
            return ResponseEntity.ok(ApiResponse.success("Shares retrieved", shares));

        } catch (Exception e) {
            log.error("Error retrieving user shares", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to retrieve shares"));
        }
    }

    /**
     * Get all shares for a specific document
     * GET /api/shares/document/{documentId}
     */
    @GetMapping("/document/{documentId}")
    public ResponseEntity<ApiResponse<List<ShareLinkResponse>>> getDocumentShares(
            @PathVariable Long documentId,
            @AuthenticationPrincipal User currentUser) {

        try {
            List<ShareLinkResponse> shares = shareLinkService.getDocumentShares(documentId, currentUser);
            return ResponseEntity.ok(ApiResponse.success("Document shares retrieved", shares));

        } catch (org.springframework.security.access.AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(e.getMessage()));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("Document not found"));
        } catch (Exception e) {
            log.error("Error retrieving document shares", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to retrieve document shares"));
        }
    }

    /**
     * Update share recipients (add/remove)
     * PATCH /api/shares/{id}/recipients
     */
    @PatchMapping("/{id}/recipients")
    public ResponseEntity<ApiResponse<ShareLinkResponse>> updateShareRecipients(
            @PathVariable Long id,
            @RequestBody UpdateShareRecipientsRequest request,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest httpRequest) {

        try {
            String ipAddress = httpRequest.getRemoteAddr();
            ShareLinkResponse response = shareLinkService.updateShareRecipients(id, request, currentUser, ipAddress);
            return ResponseEntity.ok(ApiResponse.success("Recipients updated", response));
        } catch (org.springframework.security.access.AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error(e.getMessage()));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error("Share link not found"));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("Error updating share recipients", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to update recipients: " + e.getMessage()));
        }
    }

    /**
     * Update share permission and DRM settings
     * PATCH /api/shares/{id}
     */
    @PatchMapping("/{id}")
    public ResponseEntity<ApiResponse<ShareLinkResponse>> updateShare(
            @PathVariable Long id,
            @RequestBody UpdateShareRequest request,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest httpRequest) {

        try {
            String ipAddress = httpRequest.getRemoteAddr();
            ShareLinkResponse response = shareLinkService.updateShare(id, request, currentUser, ipAddress);
            return ResponseEntity.ok(ApiResponse.success("Share updated", response));
        } catch (org.springframework.security.access.AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error(e.getMessage()));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error("Share link not found"));
        } catch (Exception e) {
            log.error("Error updating share", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to update share: " + e.getMessage()));
        }
    }

    /**
     * Approve a pending share link
     * POST /api/shares/{id}/approve
     */
    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER') or hasRole('REVIEWER')")
    public ResponseEntity<ApiResponse<Void>> approveShareLink(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest httpRequest) {

        try {
            String ipAddress = httpRequest.getRemoteAddr();
            shareLinkService.approveShareLink(id, currentUser, ipAddress);

            return ResponseEntity.ok(ApiResponse.success("Share link approved successfully", null));

        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("Share link not found"));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest()
                .body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("Error approving share link", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to approve share link"));
        }
    }

    /**
     * Reject a pending share link and optionally correct document classification level.
     * POST /api/shares/{id}/reject
     */
    @PostMapping("/{id}/reject")
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER') or hasRole('REVIEWER')")
    public ResponseEntity<ApiResponse<Void>> rejectShareLink(
            @PathVariable Long id,
            @RequestBody(required = false) RejectShareApprovalRequest request,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest httpRequest) {
        try {
            String ipAddress = httpRequest.getRemoteAddr();
            String reason = request != null ? request.getReason() : null;
            String correctedLevel = request != null ? request.getCorrectedClassificationLevel() : null;
            shareLinkService.rejectShareLink(id, currentUser, reason, correctedLevel, ipAddress);
            return ResponseEntity.ok(ApiResponse.success("Share link rejected successfully", null));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Invalid corrected classification level"));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error("Share link not found"));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        } catch (org.springframework.security.access.AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("Error rejecting share link", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to reject share link"));
        }
    }

    /**
     * Get pending share-approval queue.
     * GET /api/shares/pending-approval
     */
    @GetMapping("/pending-approval")
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER') or hasRole('REVIEWER')")
    public ResponseEntity<ApiResponse<Page<ShareLinkResponse>>> getPendingApprovals(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal User currentUser) {
        try {
            Page<ShareLinkResponse> pending = shareLinkService.getPendingApprovalShares(currentUser, page, size);
            return ResponseEntity.ok(ApiResponse.success("Pending share approvals retrieved", pending));
        } catch (org.springframework.security.access.AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("Error retrieving pending approvals", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("Failed to retrieve pending approvals"));
        }
    }

    /**
     * Get watermarked preview for shared document
     * GET /api/shares/{token}/preview
     */
    @GetMapping("/{token}/preview")
    public ResponseEntity<?> getSharedDocumentPreview(
            @PathVariable String token,
            @RequestParam(required = false) String password,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest httpRequest) {

        try {
            String ipAddress = httpRequest.getRemoteAddr();
            String userAgent = httpRequest.getHeader("User-Agent");

            // Validate share link access
            ShareLinkResponse shareResponse = shareLinkService.accessShareLink(token, password, ipAddress, currentUser);

            // Get document content
            Long documentId = shareResponse.getDocumentId();
            byte[] documentContent = documentService.getDocumentContent(documentId);

            // Get document details for file type
            var document = documentService.getDocumentById(documentId);
            String fileType = document.getFileType();

            // Apply watermark for external access
            byte[] watermarkedContent = watermarkService.applyWatermarkForExternalAccess(
                documentContent,
                fileType,
                ipAddress,
                documentId,
                token
            );

            // Determine content type
            String contentType = fileType != null ? fileType : "application/pdf";

            // Set response headers
            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.setContentType(org.springframework.http.MediaType.parseMediaType(contentType));
            headers.setCacheControl("no-cache, no-store, must-revalidate");
            headers.setPragma("no-cache");
            headers.setExpires(0);
            headers.setContentLength(watermarkedContent.length);

            // Log preview access for audit (comprehensive logging)
            // Watermark format for anonymous: ANON | timestamp | DocID:...
            String timestamp = java.time.LocalDateTime.now().format(
                java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
            String wmMeta = String.format("UID:ANON | %s | DocID:%d", timestamp, documentId);
            auditService.logEvent(
                null, // Anonymous user
                "ANONYMOUS",
                "PREVIEW_SHARED_DOCUMENT",
                "SHARE",
                "SUCCESS",
                String.format("Share link preview accessed - Token: %s, Document ID: %d, Document: %s, File Type: %s, Watermark: %s",
                    token, documentId, document.getName(), fileType, wmMeta),
                ipAddress,
                userAgent,
                null // No device fingerprint for anonymous users
            );

            log.info("Share link preview accessed - Token: {}, IP: {}, Document: {}, User-Agent: {}",
                token, ipAddress, documentId, userAgent);

            return ResponseEntity.ok()
                .headers(headers)
                .body(watermarkedContent);

        } catch (org.springframework.security.access.AccessDeniedException e) {
            // Log failed access attempt
            auditService.logEvent(
                null,
                "ANONYMOUS",
                "PREVIEW_SHARED_DOCUMENT",
                "SHARE",
                "FAILURE",
                String.format("Share link preview access denied - Token: %s, Reason: %s",
                    token, e.getMessage()),
                httpRequest.getRemoteAddr(),
                httpRequest.getHeader("User-Agent"),
                null
            );

            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(e.getMessage()));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            // Log not found attempt
            auditService.logEvent(
                null,
                "ANONYMOUS",
                "PREVIEW_SHARED_DOCUMENT",
                "SHARE",
                "FAILURE",
                String.format("Share link or document not found - Token: %s", token),
                httpRequest.getRemoteAddr(),
                httpRequest.getHeader("User-Agent"),
                null
            );

            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("Share link or document not found"));
        } catch (java.io.IOException e) {
            log.error("Error applying watermark to shared document", e);

            // Log watermark failure
            auditService.logEvent(
                null,
                "ANONYMOUS",
                "PREVIEW_SHARED_DOCUMENT",
                "SHARE",
                "FAILURE",
                String.format("Failed to apply watermark - Token: %s, Error: %s",
                    token, e.getMessage()),
                httpRequest.getRemoteAddr(),
                httpRequest.getHeader("User-Agent"),
                null
            );

            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to generate preview"));
        } catch (Exception e) {
            log.error("Error accessing shared document preview", e);

            // Log unexpected error
            auditService.logEvent(
                null,
                "ANONYMOUS",
                "PREVIEW_SHARED_DOCUMENT",
                "SHARE",
                "FAILURE",
                String.format("Unexpected error - Token: %s, Error: %s",
                    token, e.getMessage()),
                httpRequest.getRemoteAddr(),
                httpRequest.getHeader("User-Agent"),
                null
            );

            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to access preview"));
        }
    }

    /**
     * Download shared document (no auth required when token is valid).
     * GET /api/shares/{token}/download
     */
    @GetMapping("/{token}/download")
    public ResponseEntity<?> downloadSharedDocument(
            @PathVariable String token,
            @RequestParam(required = false) String password,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest httpRequest) {

        try {
            String ipAddress = httpRequest.getRemoteAddr();
            ShareLinkResponse shareResponse = shareLinkService.accessShareLink(token, password, ipAddress, currentUser);

            if (!Boolean.TRUE.equals(shareResponse.getAllowDownload())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.error("Download is not permitted for this share link"));
            }

            byte[] content = documentService.getDocumentContent(shareResponse.getDocumentId());
            var document = documentService.getDocumentById(shareResponse.getDocumentId());
            String fileType = document.getFileType() != null ? document.getFileType() : "application/octet-stream";
            String filename = document.getName() != null ? document.getName() : "document";

            // Apply external watermark for shared documents (includes IP, DocID, Token)
            if (watermarkService.supportsWatermark(fileType)) {
                content = watermarkService.applyWatermarkForExternalAccess(content, fileType, ipAddress,
                    shareResponse.getDocumentId(), token);
            }

            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.setContentType(org.springframework.http.MediaType.parseMediaType(fileType));
            headers.setContentDispositionFormData("attachment", filename);
            headers.setContentLength(content.length);

            return ResponseEntity.ok().headers(headers).body(content);
        } catch (org.springframework.security.access.AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error(e.getMessage()));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error("Share link not found or expired"));
        } catch (Exception e) {
            log.error("Error downloading shared document", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to download document"));
        }
    }

    /**
     * Generate minimal-disclosure summary for a shared document.
     * POST /api/shares/{token}/summary
     */
    @PostMapping("/{token}/summary")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSharedDocumentSummary(
            @PathVariable String token,
            @RequestParam(required = false) String password,
            @RequestParam(defaultValue = "500") Integer maxChars,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest httpRequest) {
        try {
            String ipAddress = httpRequest.getRemoteAddr();
            ShareLinkResponse share = shareLinkService.accessShareLink(token, password, ipAddress, currentUser);
            Map<String, Object> summary = documentService.generateSafeSummaryForSharedDocument(
                share.getDocumentId(),
                maxChars != null ? maxChars : 500
            );
            return ResponseEntity.ok(ApiResponse.success("Shared document summary generated", summary));
        } catch (org.springframework.security.access.AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error(e.getMessage()));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error("Share link not found or expired"));
        } catch (Exception e) {
            log.error("Failed to generate shared document summary", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to generate shared document summary: " + e.getMessage()));
        }
    }

    /**
     * Log access to shared document preview
     * POST /api/shares/{token}/access-log
     */
    @PostMapping("/{token}/access-log")
    public ResponseEntity<ApiResponse<Void>> logShareAccess(
            @PathVariable String token,
            @RequestBody(required = false) java.util.Map<String, Object> logData,
            HttpServletRequest httpRequest) {
        try {
            String ipAddress = httpRequest.getRemoteAddr();
            String userAgent = httpRequest.getHeader("User-Agent");

            // Validate share link exists
            ShareLink shareLink = shareLinkRepository.findByToken(token).orElse(null);
            if (shareLink == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error("Share link not found"));
            }

            // Extract log data
            Integer viewDuration = logData != null && logData.containsKey("viewDuration")
                ? ((Number) logData.get("viewDuration")).intValue() : null;
            @SuppressWarnings("unchecked")
            java.util.List<Integer> pageViews = logData != null && logData.containsKey("pageViews")
                ? (java.util.List<Integer>) logData.get("pageViews") : null;
            // timestamp variable is logged in the audit message below

            // Log access event
            auditService.logEvent(
                null, // Anonymous user
                "ANONYMOUS",
                "SHARE_ACCESS_LOG",
                "SHARE",
                "SUCCESS",
                String.format("Share link access logged - Token: %s, Document ID: %d, View Duration: %d seconds, Page Views: %d",
                    token, shareLink.getDocumentId(),
                    viewDuration != null ? viewDuration : 0,
                    pageViews != null ? pageViews.size() : 0),
                ipAddress,
                userAgent,
                null
            );

            log.debug("Share access logged - Token: {}, Duration: {}s, Pages: {}",
                token, viewDuration, pageViews != null ? pageViews.size() : 0);

            return ResponseEntity.ok(ApiResponse.success("Access logged", null));
        } catch (Exception e) {
            log.error("Error logging share access", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to log access"));
        }
    }
}
