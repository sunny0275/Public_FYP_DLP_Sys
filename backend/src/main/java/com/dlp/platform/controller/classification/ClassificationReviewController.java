package com.dlp.platform.controller.classification;

import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.dto.document.ApproveClassificationRequest;
import com.dlp.platform.entity.Document;
import com.dlp.platform.entity.User;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;
import com.dlp.platform.service.classification.ClassificationReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Controller for classification review workflow
 * Allows reviewers to approve document classification levels
 */
@Slf4j
@RestController
@RequestMapping("/classification")
@RequiredArgsConstructor
public class ClassificationReviewController {

    private final ClassificationReviewService classificationReviewService;

    /**
     * Get classification level options (for upload form and filters)
     * GET /api/classification/levels
     */
    @GetMapping("/levels")
    public ResponseEntity<ApiResponse<List<String>>> getClassificationLevels() {
        List<String> levels = Arrays.stream(Document.ClassificationLevel.values())
                .map(Enum::name)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success("Classification levels", levels));
    }

    /**
     * Get documents pending classification review
     * GET /api/classification/review
     * Only accessible by REVIEWER role
     */
    @GetMapping("/review")
    @PreAuthorize("hasRole('REVIEWER') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Page<java.util.Map<String, Object>>>> getPendingReviewDocuments(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "DESC") String sortDir) {
        try {
            Sort sort = sortDir.equalsIgnoreCase("ASC") ? Sort.by(sortBy).ascending() : Sort.by(sortBy).descending();
            Pageable pageable = PageRequest.of(page, size, sort);
            
            Page<java.util.Map<String, Object>> documents = classificationReviewService.getPendingReviewDocuments(pageable);
            return ResponseEntity.ok(ApiResponse.success("Pending review documents retrieved", documents));
        } catch (Exception e) {
            log.error("Error retrieving pending review documents", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to retrieve pending review documents"));
        }
    }

    /**
     * Get count of pending review documents
     * GET /api/classification/review/count
     */
    @GetMapping("/review/count")
    @PreAuthorize("hasRole('REVIEWER') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Long>> getPendingReviewCount() {
        try {
            long count = classificationReviewService.getPendingReviewCount();
            return ResponseEntity.ok(ApiResponse.success("Pending review count retrieved", count));
        } catch (Exception e) {
            log.error("Error retrieving pending review count", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to retrieve pending review count"));
        }
    }

    /**
     * Get approved (classified) documents with review history
     * GET /api/classification/approved
     * Only accessible by REVIEWER role
     */
    @GetMapping("/approved")
    @PreAuthorize("hasRole('REVIEWER') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Page<java.util.Map<String, Object>>>> getApprovedDocuments(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "updatedAt") String sortBy,
            @RequestParam(defaultValue = "DESC") String sortDir) {
        try {
            Sort sort = sortDir.equalsIgnoreCase("ASC") ? Sort.by(sortBy).ascending() : Sort.by(sortBy).descending();
            Pageable pageable = PageRequest.of(page, size, sort);
            
            Page<java.util.Map<String, Object>> documents = classificationReviewService.getApprovedDocuments(pageable);
            return ResponseEntity.ok(ApiResponse.success("Approved documents retrieved", documents));
        } catch (Exception e) {
            log.error("Error retrieving approved documents", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to retrieve approved documents"));
        }
    }

    /**
     * Get count of approved documents
     * GET /api/classification/approved/count
     */
    @GetMapping("/approved/count")
    @PreAuthorize("hasRole('REVIEWER') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Long>> getApprovedDocumentsCount() {
        try {
            long count = classificationReviewService.getApprovedDocumentsCount();
            return ResponseEntity.ok(ApiResponse.success("Approved documents count retrieved", count));
        } catch (Exception e) {
            log.error("Error retrieving approved documents count", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to retrieve approved documents count"));
        }
    }

    /**
     * Approve document classification level
     * POST /api/classification/{documentId}/approve
     * Only accessible by REVIEWER role
     */
    @PostMapping("/{documentId}/approve")
    @PreAuthorize("hasRole('REVIEWER') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> approveClassification(
            @PathVariable Long documentId,
            @Valid @RequestBody ApproveClassificationRequest request,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest httpRequest) {
        try {
            String ipAddress = httpRequest.getRemoteAddr();
            java.util.Map<String, Object> approved = classificationReviewService.approveClassification(
                documentId, currentUser, request, ipAddress
            );
            return ResponseEntity.ok(ApiResponse.success("Classification approved successfully", approved));
        } catch (org.springframework.security.access.AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest()
                .body(ApiResponse.error(e.getMessage()));
        } catch (RuntimeException e) {
            if (e.getMessage().contains("not found")) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(e.getMessage()));
            }
            log.error("Error approving classification for document {}", documentId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to approve classification"));
        }
    }
}
