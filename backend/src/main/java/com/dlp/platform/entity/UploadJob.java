package com.dlp.platform.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "upload_jobs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UploadJob {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id")
    private Document document;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    @Builder.Default
    private JobStatus status = JobStatus.PENDING;

    @Column(nullable = false)
    @Builder.Default
    private Integer progress = 0;

    @Enumerated(EnumType.STRING)
    @Column(length = 50)
    private ProcessingStep currentStep;

    @Column(length = 2000)
    private String errorMessage;

    @Column
    private Double classificationConfidence;

    @Column(length = 1000)
    private String classificationReason;

    @Enumerated(EnumType.STRING)
    @Column(length = 50)
    private Document.ClassificationLevel suggestedClassification;

    /** Snapshot of system prompt used for LLM classification (for tuning dataset when correction is recorded) */
    @Lob
    @Column(columnDefinition = "TEXT")
    private String systemPromptSnapshot;

    /** Snapshot of user prompt used for LLM classification (for tuning dataset when correction is recorded) */
    @Lob
    @Column(columnDefinition = "TEXT")
    private String userPromptSnapshot;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Column
    private LocalDateTime completedAt;

    public enum JobStatus {
        PENDING,
        PROCESSING,
        COMPLETED,
        FAILED,
        REVIEW_REQUIRED
    }

    public enum ProcessingStep {
        UPLOADING,
        VIRUS_SCANNING,
        OCR_PROCESSING,
        TEXT_EXTRACTION,
        EMBEDDING_GENERATION,
        LLM_CLASSIFICATION,
        POLICY_APPLICATION,
        WATERMARKING,
        ENCRYPTION,
        FINALIZING
    }
}
