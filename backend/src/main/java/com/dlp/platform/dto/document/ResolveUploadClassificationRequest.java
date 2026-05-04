package com.dlp.platform.dto.document;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request payload for resolving a REVIEW_REQUIRED upload classification mismatch.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ResolveUploadClassificationRequest {
    @NotBlank(message = "finalClassificationLevel is required")
    private String finalClassificationLevel; // PUBLIC|INTERNAL|CONFIDENTIAL|STRICTLY_CONFIDENTIAL

    /**
     * If true, user reports the LLM classification as incorrect.
     * The document will remain flagged for team review.
     */
    private Boolean reportLlmMistake;

    /**
     * Optional user comment / rationale.
     */
    private String comment;
}


