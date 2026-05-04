package com.dlp.platform.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Stores a single UEBA analysis example for Vertex AI supervised fine-tuning.
 *
 * When the LLM's analysis result differs from the expected/correct analysis
 * (e.g., admin overrides a false positive or flags a missed true positive),
 * this record is saved and exported as a JSONL training example for the
 * UEBA-tuned model.
 *
 * Format per line (Vertex JSONL):
 * {
 *   "systemInstruction": { "role": "system", "parts": [{ "text": "..." }] },
 *   "contents": [
 *     { "role": "user",   "parts": [{ "text": "..." }] },
 *     { "role": "model",  "parts": [{ "text": "{\"isAnomalous\":true,...}" }] }
 *   ]
 * }
 */
@Entity
@Table(name = "ueba_tuning_examples", indexes = {
        @Index(name = "idx_ueba_tuning_user_id",     columnList = "userId"),
        @Index(name = "idx_ueba_tuning_account_id",  columnList = "accountId"),
        @Index(name = "idx_ueba_tuning_created_at",   columnList = "createdAt")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UebaTuningExample {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * The user who triggered the security event.
     * Nullable when user is not yet authenticated (e.g., login failures).
     */
    @Column
    private Long userId;

    /** Human-readable account identifier (e.g. john.doe) */
    @Column(length = 128)
    private String accountId;

    /** Event action (e.g. LOGIN_FAILURE, FILE_DOWNLOAD, WINDOW_BLUR) */
    @Column(length = 128)
    private String action;

    /** Event category (e.g. AUTH, DOCUMENT, SYSTEM) */
    @Column(length = 64)
    private String category;

    /** Event result (e.g. FAILURE, WARNING, SUCCESS) */
    @Column(length = 32)
    private String result;

    /** Additional event details */
    @Lob
    @Column(columnDefinition = "TEXT")
    private String details;

    /** When the event occurred */
    @Column
    private LocalDateTime eventTimestamp;

    /** System prompt snapshot used for this analysis (for tuning reproducibility) */
    @Lob
    @Column(columnDefinition = "TEXT")
    private String systemPromptSnapshot;

    /** User prompt snapshot (event context) used for this analysis */
    @Lob
    @Column(columnDefinition = "TEXT")
    private String userPromptSnapshot;

    /** Raw LLM response text when this example was created */
    @Lob
    @Column(columnDefinition = "TEXT")
    private String llmResponseSnapshot;

    /**
     * The correct/expected analysis that should have been returned.
     * Stored as JSON matching the LlmAnalysisResult schema:
     * { "isAnomalous": bool, "confidence": 0.0-1.0, "anomalyType": "...", "reason": "...", ... }
     */
    @Lob
    @Column(columnDefinition = "TEXT", nullable = false)
    private String correctAnalysisJson;

    /**
     * How this example was generated:
     * - "admin-corrected"  : admin overrode the LLM's decision
     * - "rule-based-confirmation" : rule-based confirmed same result as LLM
     * - "seed-positive"    : manually seeded true anomaly example
     * - "seed-negative"    : manually seeded normal behavior example
     */
    @Column(length = 32)
    private String source;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
