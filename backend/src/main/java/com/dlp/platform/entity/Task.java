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

/**
 * Task Entity - Represents an approval task in a workflow
 *
 * Features:
 * - Approval/rejection with comments
 * - Task delegation and reassignment
 * - Timeout and reminders
 * - Digital signature support
 * - Full audit trail
 */
@Entity
@Table(name = "tasks", indexes = {
    @Index(name = "idx_task_assignee", columnList = "assigneeId"),
    @Index(name = "idx_task_workflow", columnList = "workflowInstanceId"),
    @Index(name = "idx_task_status", columnList = "status"),
    @Index(name = "idx_task_due_date", columnList = "dueDate")
})
@EntityListeners(AuditingEntityListener.class)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(length = 2000)
    private String description;

    @Column
    private Long workflowInstanceId; // Associated workflow instance

    @Column
    private Long documentId; // Associated document (if any)

    @Column(nullable = false)
    private Long applicantId; // User who created the application

    @Column(length = 100)
    private String applicantName;

    @Column(nullable = false)
    private Long assigneeId; // Current assignee

    @Column(length = 100)
    private String assigneeName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private TaskType taskType = TaskType.APPROVAL;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private TaskStatus status = TaskStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private UrgencyLevel urgencyLevel = UrgencyLevel.NORMAL;

    @Column
    private LocalDateTime dueDate;

    @Column
    private LocalDateTime completedAt;

    @Column
    private Long completedBy;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private TaskDecision decision; // APPROVED, REJECTED, DELEGATED

    @Column(length = 2000)
    private String comment; // Approver's comment

    @Column(length = 1000)
    private String signatureData; // Digital signature (ECDSA)

    @Column(length = 200)
    private String timestampToken; // RFC 3161 timestamp token

    @Column(length = 128)
    private String blockchainHash; // Optional blockchain anchoring

    // Delegation tracking
    @Column
    private Long delegatedFrom; // Original assignee

    @Column
    private LocalDateTime delegatedAt;

    @Column(length = 500)
    private String delegationReason;

    // Reminder tracking
    @Column(nullable = false)
    @Builder.Default
    private Integer reminderCount = 0;

    @Column
    private LocalDateTime lastReminderAt;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    // Enums
    public enum TaskType {
        APPROVAL,           // Standard approval task
        REVIEW,             // Review task
        SIGNATURE,          // Signature required
        NOTIFICATION,       // FYI notification
        CUSTOM              // Custom task type
    }

    public enum TaskStatus {
        PENDING,            // Waiting for action
        IN_PROGRESS,        // Being processed
        COMPLETED,          // Completed (approved/rejected)
        CANCELLED,          // Cancelled
        TIMEOUT,            // Exceeded due date
        DELEGATED           // Delegated to another user
    }

    public enum UrgencyLevel {
        LOW,
        NORMAL,
        HIGH,
        CRITICAL
    }

    public enum TaskDecision {
        APPROVED,           // Approved
        REJECTED,           // Rejected
        DELEGATED,          // Delegated to another user
        REASSIGNED          // Reassigned to another user
    }

    // Helper methods
    public boolean isOverdue() {
        return dueDate != null
            && LocalDateTime.now().isAfter(dueDate)
            && status == TaskStatus.PENDING;
    }

    public boolean canBeCompletedBy(Long userId) {
        return userId != null
            && assigneeId != null
            && assigneeId.equals(userId)
            && status == TaskStatus.PENDING;
    }

    public void approve(Long userId, String comment, String signature) {
        if (!canBeCompletedBy(userId)) {
            throw new IllegalStateException("User cannot complete this task");
        }
        this.status = TaskStatus.COMPLETED;
        this.decision = TaskDecision.APPROVED;
        this.completedAt = LocalDateTime.now();
        this.completedBy = userId;
        this.comment = comment;
        this.signatureData = signature;
    }

    public void reject(Long userId, String comment) {
        if (!canBeCompletedBy(userId)) {
            throw new IllegalStateException("User cannot complete this task");
        }
        this.status = TaskStatus.COMPLETED;
        this.decision = TaskDecision.REJECTED;
        this.completedAt = LocalDateTime.now();
        this.completedBy = userId;
        this.comment = comment;
    }

    public void delegate(Long fromUserId, Long toUserId, String reason) {
        if (assigneeId == null || !assigneeId.equals(fromUserId)) {
            throw new IllegalStateException("Only the current assignee can delegate this task");
        }
        if (status != TaskStatus.PENDING && status != TaskStatus.IN_PROGRESS) {
            throw new IllegalStateException("Cannot delegate a task that is " + status);
        }
        if (toUserId == null) {
            throw new IllegalArgumentException("Target user ID cannot be null");
        }
        this.delegatedFrom = this.assigneeId;
        this.assigneeId = toUserId;
        this.status = TaskStatus.PENDING; // Reset to PENDING for new assignee
        this.delegatedAt = LocalDateTime.now();
        this.delegationReason = reason;
    }

    public void sendReminder() {
        this.reminderCount = (this.reminderCount == null ? 0 : this.reminderCount) + 1;
        this.lastReminderAt = LocalDateTime.now();
    }
}
