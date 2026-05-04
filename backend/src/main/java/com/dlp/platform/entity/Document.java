package com.dlp.platform.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(name = "documents", indexes = {
    @Index(name = "idx_document_owner", columnList = "owner_id"),
    @Index(name = "idx_document_dept", columnList = "department"),
    @Index(name = "idx_document_classification", columnList = "classificationLevel"),
    @Index(name = "idx_document_status", columnList = "status"),
    @Index(name = "idx_document_hidden", columnList = "hidden"),
    @Index(name = "idx_document_created", columnList = "createdAt")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Document {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 500)
    private String name;

    @Column(name = "original_filename", nullable = false, length = 500)
    private String originalFilename;

    @Column(length = 2000)
    private String description;

    /**
     * Optional document template type selected by user during upload.
     * Examples: EMPLOYEE_ONBOARDING, FINANCIAL_REPORT, CUSTOMER_DATA, CONTRACT, INVOICE, MEETING_MINUTES
     */
    @Column(length = 100)
    private String templateType;

    /**
     * Optional structured fields captured from the upload "fill-in-the-blank" form.
     * Stored as JSON text to improve downstream LLM classification and search.
     */
    @Column(columnDefinition = "TEXT")
    private String templateDataJson;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(nullable = false, length = 100)
    private String department;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private ClassificationLevel classificationLevel;

    @Column(nullable = false, length = 500)
    private String filePath;

    @Column(nullable = false, length = 100)
    private String fileName;

    @Column(nullable = false, length = 50)
    private String fileType;

    @Column(length = 100)
    private String mimeType; // application/pdf, image/jpeg, etc.

    @Column(nullable = false)
    private Long fileSize;

    @Column
    private Integer pageCount;

    @Column(length = 128)
    private String contentHash; // SHA-256 hash for integrity verification

    @Column(name = "preview_path", length = 1000)
    private String previewPath; // Path to preview file (converted PDF)

    @Column(name = "thumbnail_path", length = 1000)
    private String thumbnailPath; // Path to thumbnail image

    @Column(name = "encrypted", nullable = false)
    @Builder.Default
    private Boolean encrypted = false;

    @Column(name = "encryption_key_id", length = 128)
    private String encryptionKeyId; // Reference to KMS key

    @Column(name = "auto_classified", nullable = false)
    @Builder.Default
    private Boolean autoClassified = false;

    // Text content for search and analysis
    @Column(columnDefinition = "TEXT")
    private String extractedText;

    // Vector embeddings for semantic search (stored as JSON array)
    @Column(columnDefinition = "TEXT")
    private String embeddingVector;

    // PII detection results
    @Column(nullable = false)
    @Builder.Default
    private Boolean containsPii = false;

    @Column(nullable = false)
    @Builder.Default
    @Deprecated // PHI is not used in HK-focused deployments; kept for backward DB compatibility
    private Boolean containsPhi = false;

    @Column(columnDefinition = "TEXT")
    private String piiDetails; // JSON: detected patterns with locations

    // DRM and watermark controls
    @Column(nullable = false)
    @Builder.Default
    private Boolean requiresWatermark = true;

    @Column(nullable = false)
    @Builder.Default
    private Boolean allowDownload = true;

    @Column(nullable = false)
    @Builder.Default
    private Boolean allowPrint = true;

    @Column(nullable = false)
    @Builder.Default
    private Boolean allowCopy = true;

    @Column(nullable = false)
    @Builder.Default
    private Boolean allowShare = true;

    @Column
    private LocalDateTime lastAccessedAt;

    @ManyToMany(fetch = FetchType.LAZY, cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinTable(
        name = "document_tags",
        joinColumns = @JoinColumn(name = "document_id"),
        inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    @Builder.Default
    private Set<Tag> tags = new HashSet<>();

    @OneToMany(mappedBy = "document", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<DocumentVersion> versions = new ArrayList<>();

    @OneToMany(mappedBy = "document", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<DocumentActivity> activities = new ArrayList<>();

    @Column
    private LocalDateTime expirationDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    @Builder.Default
    private DocumentStatus status = DocumentStatus.PROCESSING;

    @Column
    private Double classificationConfidence;

    @Column(length = 2000)
    private String classificationReason;

    @Column
    @Builder.Default
    private Boolean requiresReview = false;

    @Column(nullable = false)
    @Builder.Default
    private Integer version = 1;

    @Column(nullable = false)
    @Builder.Default
    private Long viewCount = 0L;

    @Column(nullable = false)
    @Builder.Default
    private Long downloadCount = 0L;

    @Column(nullable = false)
    @Builder.Default
    private Long shareCount = 0L;

    @Column(name = "deleted", nullable = false)
    @Builder.Default
    private Boolean deleted = false;

    /**
     * Hidden documents are not visible in any document lists.
     * Used when upload fails (e.g. LLM unavailable) to silently discard
     * the record without leaving orphan entries in the user's document list.
     * Only accessible by direct ID lookup (e.g. via job polling) for the owner.
     */
    @Column(name = "hidden", nullable = false)
    @Builder.Default
    private Boolean hidden = false;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Column(name = "deleted_by")
    private Long deletedBy;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    public enum ClassificationLevel {
        PUBLIC,
        INTERNAL,
        CONFIDENTIAL,
        STRICTLY_CONFIDENTIAL
    }

    public enum DocumentStatus {
        PROCESSING,      // Being processed (upload/classification)
        CLASSIFIED,      // Successfully classified and ready
        REVIEW_REQUIRED, // Needs manual classification review
        FAILED,          // Processing failed
        ARCHIVED,        // Archived
        ACTIVE,          // Active and accessible
        QUARANTINED,     // Flagged by virus scan
        DELETED          // Soft deleted
    }

    public void incrementViewCount() {
        this.viewCount++;
        this.lastAccessedAt = LocalDateTime.now();
    }

    public void incrementDownloadCount() {
        this.downloadCount++;
        this.lastAccessedAt = LocalDateTime.now();
    }

    public void incrementShareCount() {
        this.shareCount++;
    }

    public void softDelete(Long deletedBy) {
        this.deleted = true;
        this.deletedAt = LocalDateTime.now();
        this.deletedBy = deletedBy;
        this.status = DocumentStatus.DELETED;
    }

    public boolean isExpired() {
        return expirationDate != null && LocalDateTime.now().isAfter(expirationDate);
    }

    public boolean isHighlyConfident() {
        return classificationConfidence != null && classificationConfidence >= 0.7;
    }
}
