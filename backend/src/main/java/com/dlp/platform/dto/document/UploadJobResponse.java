package com.dlp.platform.dto.document;

import com.dlp.platform.entity.UploadJob;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UploadJobResponse {

    private Long id;
    private Long documentId;
    private String status;
    private Integer progress;
    private String currentStep;
    private String errorMessage;
    private Double classificationConfidence;
    private String classificationReason;
    private String suggestedClassification;
    private String userSelectedClassification;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime completedAt;
    // Physical storage path of the uploaded file (server-side path)
    private String filePath;
    // True when document was sent for reviewer approval (user chose "Keep my level and report")
    private Boolean documentRequiresReview;

    public static UploadJobResponse from(UploadJob job) {
        return UploadJobResponse.builder()
            .id(job.getId())
            .documentId(job.getDocument() != null ? job.getDocument().getId() : null)
            .status(job.getStatus().name())
            .progress(job.getProgress())
            .currentStep(job.getCurrentStep() != null ? job.getCurrentStep().name() : null)
            .errorMessage(job.getErrorMessage())
            .classificationConfidence(job.getClassificationConfidence())
            .classificationReason(job.getClassificationReason())
            .suggestedClassification(job.getSuggestedClassification() != null ?
                job.getSuggestedClassification().name() : null)
            .userSelectedClassification(job.getDocument() != null && job.getDocument().getClassificationLevel() != null
                ? job.getDocument().getClassificationLevel().name()
                : null)
            .createdAt(job.getCreatedAt())
            .updatedAt(job.getUpdatedAt())
            .completedAt(job.getCompletedAt())
            .filePath(job.getDocument() != null ? job.getDocument().getFilePath() : null)
            .documentRequiresReview(job.getDocument() != null ? job.getDocument().getRequiresReview() : null)
            .build();
    }
}
