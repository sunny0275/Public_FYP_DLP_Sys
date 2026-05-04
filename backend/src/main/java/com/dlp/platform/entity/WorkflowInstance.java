package com.dlp.platform.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * WorkflowInstance Entity - Represents a workflow execution instance
 *
 * Features:
 * - Workflow execution state tracking
 * - Step progression and history
 * - Approval chain audit trail
 * - Cancellation and escalation support
 */
@Entity
@Table(name = "workflow_instances", indexes = {
    @Index(name = "idx_workflow_template", columnList = "templateId"),
    @Index(name = "idx_workflow_initiator", columnList = "initiatorId"),
    @Index(name = "idx_workflow_status", columnList = "status"),
    @Index(name = "idx_workflow_document", columnList = "documentId")
})
@EntityListeners(AuditingEntityListener.class)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowInstance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long templateId; // WorkflowTemplate ID

    @Column(nullable = false, length = 200)
    private String workflowName; // Snapshot of template name

    @Column(nullable = false)
    private Long initiatorId; // User who started the workflow

    @Column(length = 100)
    private String initiatorName;

    @Column
    private Long documentId; // Related document (if any)

    @Column
    private Long shareId; // Related share link (if any)

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private WorkflowStatus status = WorkflowStatus.PENDING;

    @Column(nullable = false)
    @Builder.Default
    private Integer currentStep = 0;

    @Column(nullable = false)
    @Builder.Default
    private Integer totalSteps = 0;

    // Current state stored as JSON
    @Column(columnDefinition = "TEXT")
    private String stateJson; // JSON object storing workflow variables

    // Execution history stored as JSON array
    @Column(columnDefinition = "TEXT")
    private String historyJson; // JSON array of step execution history

    @Column
    private LocalDateTime startedAt;

    @Column
    private LocalDateTime completedAt;

    @Column
    private Long completedBy;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private WorkflowDecision finalDecision; // Overall workflow decision

    @Column(length = 2000)
    private String completionComment;

    // Cancellation tracking
    @Column
    private LocalDateTime cancelledAt;

    @Column
    private Long cancelledBy;

    @Column(length = 500)
    private String cancellationReason;

    @OneToMany(mappedBy = "workflowInstanceId", cascade = CascadeType.ALL)
    @Builder.Default
    private List<Task> tasks = new ArrayList<>();

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    // Enums
    public enum WorkflowStatus {
        PENDING,                // Not yet started
        RUNNING,                // In progress
        COMPLETED,              // Successfully completed
        REJECTED,               // Rejected
        CANCELLED,              // Cancelled
        TIMEOUT                 // Exceeded deadline
    }

    public enum WorkflowDecision {
        APPROVED,               // All steps approved
        REJECTED,               // Rejected at some step
        CANCELLED,              // Cancelled by initiator/admin
        TIMEOUT                 // Exceeded deadline
    }

    // Helper methods
    public boolean isActive() {
        return status == WorkflowStatus.RUNNING || status == WorkflowStatus.PENDING;
    }

    public boolean isCompleted() {
        return status == WorkflowStatus.COMPLETED
            || status == WorkflowStatus.REJECTED
            || status == WorkflowStatus.CANCELLED
            || status == WorkflowStatus.TIMEOUT;
    }

    public void start() {
        this.status = WorkflowStatus.RUNNING;
        this.startedAt = LocalDateTime.now();
    }

    public void complete(WorkflowDecision decision, Long completedBy, String comment) {
        this.status = decision == WorkflowDecision.APPROVED
            ? WorkflowStatus.COMPLETED
            : WorkflowStatus.REJECTED;
        this.finalDecision = decision;
        this.completedAt = LocalDateTime.now();
        this.completedBy = completedBy;
        this.completionComment = comment;
    }

    public void cancel(Long cancelledBy, String reason) {
        this.status = WorkflowStatus.CANCELLED;
        this.finalDecision = WorkflowDecision.CANCELLED;
        this.cancelledAt = LocalDateTime.now();
        this.cancelledBy = cancelledBy;
        this.cancellationReason = reason;
    }

    public void advanceStep() {
        this.currentStep++;
    }

    public boolean isLastStep() {
        return currentStep >= totalSteps - 1;
    }
}
