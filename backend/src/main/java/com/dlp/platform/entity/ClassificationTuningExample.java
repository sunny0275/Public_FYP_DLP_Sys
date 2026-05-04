package com.dlp.platform.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Stores a single correction example for Vertex AI supervised fine-tuning:
 * when the LLM suggested level was wrong and the reviewer/user confirmed the correct level.
 * Used to build a JSONL dataset for Gemini document classification tuning.
 */
@Entity
@Table(name = "classification_tuning_examples", indexes = {
    @Index(name = "idx_tuning_document_id", columnList = "documentId"),
    @Index(name = "idx_tuning_created_at", columnList = "createdAt")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClassificationTuningExample {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long documentId;

    @Column(nullable = false)
    private Long uploadJobId;

    /** LLM-suggested level (wrong) */
    @Column(nullable = false, length = 32)
    private String suggestedLevel;

    /** Reviewer/user-confirmed correct level */
    @Column(nullable = false, length = 32)
    private String correctLevel;

    /** Snapshot of system prompt used for this classification (for tuning dataset) */
    @Lob
    @Column(columnDefinition = "TEXT")
    private String systemPromptSnapshot;

    /** Snapshot of user prompt (document text + metadata) used for this classification */
    @Lob
    @Column(columnDefinition = "TEXT")
    private String userPromptSnapshot;

    /** Correct model output JSON for tuning (classificationLevel, confidence, reason, suggestedTags, etc.) */
    @Lob
    @Column(columnDefinition = "TEXT")
    private String correctOutputJson;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
