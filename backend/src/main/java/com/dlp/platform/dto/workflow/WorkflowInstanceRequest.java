package com.dlp.platform.dto.workflow;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO for starting a workflow instance
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowInstanceRequest {

    @NotNull(message = "Template ID is required")
    private Long templateId;

    private Long documentId; // Optional: for document-related workflows

    private Long shareId; // Optional: for share approval workflows

    private String reason; // Reason for starting workflow

    private String contextJson; // Optional: additional context data
}
