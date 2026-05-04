package com.dlp.platform.dto.workflow;

import com.dlp.platform.entity.WorkflowTemplate;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO for creating/updating workflow templates
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowTemplateRequest {

    @NotBlank(message = "Template name is required")
    private String name;

    private String description;

    @NotNull(message = "Workflow type is required")
    private WorkflowTemplate.WorkflowType workflowType;

    @NotBlank(message = "Workflow steps are required")
    private String stepsJson; // JSON array of workflow step definitions
}
