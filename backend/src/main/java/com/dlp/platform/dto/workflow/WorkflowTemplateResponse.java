package com.dlp.platform.dto.workflow;

import com.dlp.platform.entity.WorkflowTemplate;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Response DTO for workflow template details
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowTemplateResponse {

    private Long id;
    private String name;
    private String description;
    private WorkflowTemplate.WorkflowType workflowType;
    private String stepsJson;
    private Integer version;
    private WorkflowTemplate.TemplateStatus status;
    private Long createdBy;
    private Long publishedBy;
    private LocalDateTime publishedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static WorkflowTemplateResponse from(WorkflowTemplate template) {
        return WorkflowTemplateResponse.builder()
            .id(template.getId())
            .name(template.getName())
            .description(template.getDescription())
            .workflowType(template.getWorkflowType())
            .stepsJson(template.getStepsJson())
            .version(template.getVersion())
            .status(template.getStatus())
            .createdBy(template.getCreatedBy())
            .publishedBy(template.getPublishedBy())
            .publishedAt(template.getPublishedAt())
            .createdAt(template.getCreatedAt())
            .updatedAt(template.getUpdatedAt())
            .build();
    }
}
