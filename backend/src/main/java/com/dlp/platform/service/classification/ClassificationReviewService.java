package com.dlp.platform.service.classification;

import com.dlp.platform.dto.document.ApproveClassificationRequest;
import com.dlp.platform.entity.Document;
import com.dlp.platform.entity.SignatureRecord;
import com.dlp.platform.entity.UploadJob;
import com.dlp.platform.entity.User;
import com.dlp.platform.repository.DocumentRepository;
import com.dlp.platform.repository.UploadJobRepository;
import com.dlp.platform.service.audit.AuditService;
import com.dlp.platform.service.document.DocumentService;
import com.dlp.platform.service.signature.SignatureService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Service for classification review workflow
 * Handles reviewer approval of document classification levels
 * 
 * Digital Signature Evidence Integration:
 * When a reviewer approves a classification, the system creates a cryptographic
 * signature record that binds:
 * 1. Reviewer's identity and credentials
 * 2. The classification decision (approve/reject)
 * 3. The document content hash (what was actually approved)
 * 4. RFC 3161 timestamp from trusted time authority
 * 5. Optional blockchain anchor for long-term tamper evidence
 * 
 * This creates a complete non-repudiation trail proving "who approved what content when".
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ClassificationReviewService {

    private final DocumentRepository documentRepository;
    private final UploadJobRepository uploadJobRepository;
    private final AuditService auditService;
    private final ClassificationTuningService classificationTuningService;
    private final SignatureService signatureService;
    private final DocumentService documentService;

    /**
     * Get documents pending classification review
     * Only accessible by REVIEWER role
     */
    @Transactional(readOnly = true)
    public Page<Map<String, Object>> getPendingReviewDocuments(Pageable pageable) {
        Page<Document> documents = documentRepository.findByStatusAndRequiresReview(
            Document.DocumentStatus.REVIEW_REQUIRED,
            true,
            pageable
        );
        List<Map<String, Object>> mapped = documents.getContent().stream()
            .map(this::toReviewDocumentSummary)
            .toList();
        return new PageImpl<>(mapped, pageable, documents.getTotalElements());
    }

    private Map<String, Object> toReviewDocumentSummary(Document doc) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", doc.getId());
        map.put("name", doc.getName() != null && !doc.getName().isBlank() ? doc.getName() : doc.getFileName());
        map.put("description", doc.getDescription());
        map.put("ownerName", doc.getOwner() != null
            ? (doc.getOwner().getFullName() != null && !doc.getOwner().getFullName().isBlank()
                ? doc.getOwner().getFullName()
                : doc.getOwner().getAccountId())
            : "Unknown");
        map.put("department", doc.getDepartment());
        map.put("classificationLevel", doc.getClassificationLevel() != null ? doc.getClassificationLevel().name() : null);
        map.put("status", doc.getStatus() != null ? doc.getStatus().name() : null);
        map.put("requiresReview", Boolean.TRUE.equals(doc.getRequiresReview()));
        map.put("classificationConfidence", doc.getClassificationConfidence());
        map.put("classificationReason", doc.getClassificationReason());
        map.put("createdAt", doc.getCreatedAt());
        map.put("updatedAt", doc.getUpdatedAt());
        return map;
    }

    /**
     * Approve document classification level by reviewer
     * This confirms the classification level and makes the document accessible to others
     * 
     * Digital Signature Evidence:
     * When approved, creates a cryptographic signature record that binds:
     * - Reviewer's identity
     * - Decision and document content hash
     * - RFC 3161 timestamp + blockchain anchor
     * 
     * This creates non-repudiation evidence proving "who approved what content when".
     */
    @Transactional
    public Map<String, Object> approveClassification(Long documentId, User reviewer, ApproveClassificationRequest request, String ipAddress) {
        Document document = documentRepository.findById(documentId)
            .orElseThrow(() -> new RuntimeException("Document not found"));

        if (document.getStatus() != Document.DocumentStatus.REVIEW_REQUIRED && 
            !Boolean.TRUE.equals(document.getRequiresReview())) {
            throw new IllegalStateException("Document is not pending review");
        }

        // Check if reviewer has permission
        boolean isReviewer = reviewer.getRoles() != null && reviewer.getRoles().stream()
            .anyMatch(r -> {
                if (r == null) return false;
                String normalized = r.trim().toUpperCase();
                return normalized.equals("REVIEWER") || normalized.equals("ROLE_REVIEWER");
            });
        boolean isAdmin = reviewer.getRoles() != null && reviewer.getRoles().stream()
            .anyMatch(r -> {
                if (r == null) return false;
                String normalized = r.trim().toUpperCase();
                return normalized.equals("ADMIN") || normalized.equals("ROLE_ADMIN");
            });

        if (!isReviewer && !isAdmin) {
            throw new org.springframework.security.access.AccessDeniedException("Only reviewers can approve classifications");
        }

        // Validate request
        if (!request.getApproveCurrentLevel() && 
            (request.getApprovedClassificationLevel() == null || request.getApprovedClassificationLevel().isBlank())) {
            throw new IllegalStateException("Classification level is required when approving a different level");
        }

        // Apply approved classification level
        Document.ClassificationLevel finalLevel;
        if (request.getApproveCurrentLevel()) {
            // Approve current level (user's selected level)
            finalLevel = document.getClassificationLevel();
            log.info("Reviewer {} approved current classification level {} for document {}",
                reviewer.getAccountId(), document.getClassificationLevel(), documentId);
        } else {
            // Override with new level
            finalLevel = Document.ClassificationLevel.valueOf(
                request.getApprovedClassificationLevel().trim().toUpperCase()
            );
            document.setClassificationLevel(finalLevel);
            log.info("Reviewer {} overrode classification level to {} for document {}",
                reviewer.getAccountId(), finalLevel, documentId);
        }

        // Mark as approved and classified
        document.setRequiresReview(false);
        document.setStatus(Document.DocumentStatus.CLASSIFIED);
        
        // Update classification reason with reviewer approval
        String reviewerComment = request.getComment() != null ? request.getComment().trim() : "";
        String baseReason = document.getClassificationReason() != null ? document.getClassificationReason() : "";
        String appended = " | Reviewer approved: " + reviewer.getAccountId()
            + (reviewerComment.isBlank() ? "" : (", comment: " + reviewerComment))
            + ", approved at: " + LocalDateTime.now();
        document.setClassificationReason((baseReason + appended).trim());

        documentRepository.save(document);

        // Update related upload job if exists; record tuning example when LLM suggestion was wrong
        List<UploadJob> relatedJobs = uploadJobRepository.findByDocumentId(documentId);
        String confirmedLevel = document.getClassificationLevel().name();
        for (UploadJob job : relatedJobs) {
            if (job.getStatus() == UploadJob.JobStatus.REVIEW_REQUIRED) {
                job.setStatus(UploadJob.JobStatus.COMPLETED);
                job.setProgress(100);
                job.setCompletedAt(LocalDateTime.now());
                // Update classification reason in job
                String jobReason = job.getClassificationReason() != null ? job.getClassificationReason() : "";
                String reviewerNote = " | Reviewer approved: " + reviewer.getAccountId() + " at " + LocalDateTime.now();
                job.setClassificationReason((jobReason + reviewerNote).trim());
                uploadJobRepository.save(job);
            }
            // When a reviewer confirms a level, always feed it back into tuning:
            // - If it differs from the LLM suggestion → record as a correction example.
            // - If it matches the LLM suggestion → record as a confirmed/accepted example.
            if (job.getSuggestedClassification() != null) {
                try {
                    if (!job.getSuggestedClassification().name().equals(document.getClassificationLevel().name())) {
                        // Use .name() comparison to avoid enum reference issues
                        classificationTuningService.recordCorrection(documentId, job.getId(), confirmedLevel);
                    } else {
                        classificationTuningService.recordAcceptedSuggestion(documentId, job.getId(), confirmedLevel);
                    }
                } catch (Exception e) {
                    log.warn("Failed to record classification tuning example: {}", e.getMessage());
                }
            }
        }

        // ========== Create Digital Signature Evidence ==========
        // This creates a cryptographic binding between the reviewer, the document content,
        // and the classification decision for non-repudiation.
        SignatureRecord signatureRecord = null;
        String signatureError = null;
        try {
            // Get the canonical document content hash for signing (internal method bypasses permission checks)
            String documentHash = documentService.getDocumentContentHashInternal(documentId);
            
            // Log signature context for audit trail (binds classification decision to document content)
            // Format: "CLASSIFICATION_APPROVE|DOC:{docId}|LEVEL:{level}|USER:{userId}|TIME:{timestamp}"
            log.debug("Creating signature evidence for classification approval: documentId={}, level={}, reviewerId={}",
                documentId, finalLevel, reviewer.getId());
            
            // Create the signature record with full evidence chain
            signatureRecord = signatureService.signDocument(
                documentId,
                documentHash,
                reviewer.getId(),
                request.getPrivateKeyHex(),
                ipAddress,
                request.getDeviceFingerprint(),
                request.getMfaCode(),
                "CLASSIFICATION_APPROVE",
                "Classification Approval"
            );
            
            log.info("Electronic signature evidence created for classification approval: " +
                "documentId={}, reviewerId={}, signatureId={}, level={}",
                documentId, reviewer.getId(), signatureRecord.getId(), finalLevel);
                
        } catch (Exception e) {
            // Log but don't fail the approval if signature creation fails
            // The classification is still valid, but we lose non-repudiation evidence
            signatureError = e.getMessage();
            log.error("Failed to create digital signature evidence for document {}: {}",
                documentId, e.getMessage(), e);
        }
        // ========== End Digital Signature Evidence ==========

        // Log audit event
        auditService.logEvent(
            reviewer.getId(),
            reviewer.getAccountId(),
            "APPROVE_CLASSIFICATION",
            "DOCUMENT",
            "SUCCESS",
            String.format("Reviewer approved classification level %s for document %d. Comment: %s. Signature: %s",
                document.getClassificationLevel(), documentId, reviewerComment,
                signatureRecord != null ? "created(id=" + signatureRecord.getId() + ")" : "failed: " + signatureError),
            ipAddress,
            signatureRecord != null ? signatureRecord.getId().toString() : null,
            signatureRecord != null ? signatureRecord.getBlockchainTxHash() : null
        );

        log.info("Document {} classification approved by reviewer {}", documentId, reviewer.getAccountId());
        
        // Return as Map to avoid Hibernate proxy serialization issues
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", document.getId());
        result.put("name", document.getName());
        result.put("classificationLevel", document.getClassificationLevel().name());
        result.put("status", document.getStatus().name());
        result.put("approvedBy", reviewer.getAccountId());
        result.put("approvedAt", LocalDateTime.now());
        
        // Include signature evidence info if available
        if (signatureRecord != null) {
            result.put("signatureId", signatureRecord.getId());
            result.put("signatureTimestamp", signatureRecord.getSignedAt());
            result.put("blockchainTxHash", signatureRecord.getBlockchainTxHash());
            result.put("signatureStatus", "VALID");
        } else {
            result.put("signatureError", signatureError);
            result.put("signatureStatus", "FAILED");
        }
        
        return result;
    }

    /**
     * Get count of pending review documents
     */
    @Transactional(readOnly = true)
    public long getPendingReviewCount() {
        return documentRepository.countByStatusAndRequiresReview(
            Document.DocumentStatus.REVIEW_REQUIRED,
            true
        );
    }

    /**
     * Get approved (classified) documents with review history
     * Only documents that have been reviewed (requiresReview = false, status = CLASSIFIED)
     */
    @Transactional(readOnly = true)
    public Page<Map<String, Object>> getApprovedDocuments(Pageable pageable) {
        Page<Document> documents = documentRepository.findByStatusAndRequiresReview(
            Document.DocumentStatus.CLASSIFIED,
            false,
            pageable
        );
        List<Map<String, Object>> mapped = documents.getContent().stream()
            .map(this::toApprovedDocumentSummary)
            .toList();
        return new PageImpl<>(mapped, pageable, documents.getTotalElements());
    }

    private Map<String, Object> toApprovedDocumentSummary(Document doc) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", doc.getId());
        map.put("name", doc.getName() != null && !doc.getName().isBlank() ? doc.getName() : doc.getFileName());
        map.put("description", doc.getDescription());
        map.put("ownerName", doc.getOwner() != null
            ? (doc.getOwner().getFullName() != null && !doc.getOwner().getFullName().isBlank()
                ? doc.getOwner().getFullName()
                : doc.getOwner().getAccountId())
            : "Unknown");
        map.put("department", doc.getDepartment());
        map.put("classificationLevel", doc.getClassificationLevel() != null ? doc.getClassificationLevel().name() : null);
        map.put("status", doc.getStatus() != null ? doc.getStatus().name() : null);
        map.put("requiresReview", Boolean.TRUE.equals(doc.getRequiresReview()));
        map.put("classificationConfidence", doc.getClassificationConfidence());
        map.put("classificationReason", doc.getClassificationReason());
        map.put("createdAt", doc.getCreatedAt());
        map.put("updatedAt", doc.getUpdatedAt());
        return map;
    }

    /**
     * Get count of approved documents
     */
    @Transactional(readOnly = true)
    public long getApprovedDocumentsCount() {
        return documentRepository.countByStatusAndRequiresReview(
            Document.DocumentStatus.CLASSIFIED,
            false
        );
    }
}
