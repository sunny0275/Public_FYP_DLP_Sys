package com.dlp.platform.dto.document;

import com.dlp.platform.entity.Document;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Result of LLM-based document classification
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClassificationResult {

    /**
     * Determined classification level
     */
    private Document.ClassificationLevel classificationLevel;

    /**
     * Confidence score (0.0 - 1.0)
     */
    private Double confidence;

    /**
     * Explanation/reasoning for classification
     */
    private String reason;

    /**
     * Suggested tags based on content
     */
    @Builder.Default
    private List<String> suggestedTags = new ArrayList<>();

    /**
     * Types of sensitive information detected
     */
    @Builder.Default
    private List<String> detectedSensitiveInfo = new ArrayList<>();

    /**
     * Whether manual review is required
     */
    private boolean requiresManualReview;
}
