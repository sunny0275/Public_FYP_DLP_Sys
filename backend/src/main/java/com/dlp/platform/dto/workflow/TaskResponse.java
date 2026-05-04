package com.dlp.platform.dto.workflow;

import com.dlp.platform.entity.Task;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Response DTO for task details
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskResponse {

    private Long id;
    private String title;
    private String description;
    private Long workflowInstanceId;
    private Long documentId;
    private String documentName;
    private Long applicantId;
    private String applicantName;
    private Long assigneeId;
    private String assigneeName;
    private Task.TaskType taskType;
    private Task.TaskStatus status;
    private Task.UrgencyLevel urgencyLevel;
    private LocalDateTime dueDate;
    private LocalDateTime completedAt;
    private Long completedBy;
    private Task.TaskDecision decision;
    private String comment;
    private Boolean isOverdue;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // Delegation info
    private Long delegatedFrom;
    private LocalDateTime delegatedAt;

    public static TaskResponse from(Task task) {
        return TaskResponse.builder()
            .id(task.getId())
            .title(task.getTitle())
            .description(task.getDescription())
            .workflowInstanceId(task.getWorkflowInstanceId())
            .documentId(task.getDocumentId())
            .applicantId(task.getApplicantId())
            .applicantName(task.getApplicantName())
            .assigneeId(task.getAssigneeId())
            .assigneeName(task.getAssigneeName())
            .taskType(task.getTaskType())
            .status(task.getStatus())
            .urgencyLevel(task.getUrgencyLevel())
            .dueDate(task.getDueDate())
            .completedAt(task.getCompletedAt())
            .completedBy(task.getCompletedBy())
            .decision(task.getDecision())
            .comment(task.getComment())
            .isOverdue(task.isOverdue())
            .createdAt(task.getCreatedAt())
            .updatedAt(task.getUpdatedAt())
            .delegatedFrom(task.getDelegatedFrom())
            .delegatedAt(task.getDelegatedAt())
            .build();
    }
}
