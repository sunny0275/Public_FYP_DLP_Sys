package com.dlp.platform.dto.workflow;

import com.dlp.platform.entity.WorkflowInstance;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Response DTO for workflow instance details
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowInstanceResponse {

    private Long id;
    private Long templateId;
    private String workflowName;
    private Long initiatorId;
    private String initiatorName;
    private Long documentId;
    private Long shareId;
    private WorkflowInstance.WorkflowStatus status;
    private Integer currentStep;
    private Integer totalSteps;
    private String stateJson;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
    private Long completedBy;
    private WorkflowInstance.WorkflowDecision finalDecision;
    private String completionComment;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // Associated tasks
    private List<TaskResponse> tasks;

    public static WorkflowInstanceResponse from(WorkflowInstance instance) {
        return WorkflowInstanceResponse.builder()
            .id(instance.getId())
            .templateId(instance.getTemplateId())
            .workflowName(instance.getWorkflowName())
            .initiatorId(instance.getInitiatorId())
            .initiatorName(instance.getInitiatorName())
            .documentId(instance.getDocumentId())
            .shareId(instance.getShareId())
            .status(instance.getStatus())
            .currentStep(instance.getCurrentStep())
            .totalSteps(instance.getTotalSteps())
            .stateJson(instance.getStateJson())
            .startedAt(instance.getStartedAt())
            .completedAt(instance.getCompletedAt())
            .completedBy(instance.getCompletedBy())
            .finalDecision(instance.getFinalDecision())
            .completionComment(instance.getCompletionComment())
            .createdAt(instance.getCreatedAt())
            .updatedAt(instance.getUpdatedAt())
            .build();
    }
}
