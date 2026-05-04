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
 * WorkflowTemplate Entity - Defines approval workflow templates
 *
 * Features:
 * - Configurable approval chains (serial/parallel)
 * - Role-based or user-based assignees
 * - Conditional branching
 * - Timeout and escalation rules
 * - Version management
 */
@Entity
@Table(name = "workflow_templates", indexes = {
    @Index(name = "idx_template_name", columnList = "name"),
    @Index(name = "idx_template_status", columnList = "status")
})
@EntityListeners(AuditingEntityListener.class)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 1000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private WorkflowType workflowType = WorkflowType.DOCUMENT_APPROVAL;

    // Workflow steps stored as JSON
    @Column(columnDefinition = "TEXT", nullable = false)
    private String stepsJson; // JSON array of workflow steps

    @Column(nullable = false)
    @Builder.Default
    private Integer version = 1;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private TemplateStatus status = TemplateStatus.DRAFT;

    @Column(nullable = false)
    private Long createdBy;

    @Column
    private Long publishedBy;

    @Column
    private LocalDateTime publishedAt;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    // Enums
    public enum WorkflowType {
        DOCUMENT_APPROVAL,      // Document access/download approval
        SHARE_APPROVAL,         // Document share approval
        CLASSIFICATION_REVIEW,  // Classification review
        CUSTOM                  // Custom workflow
    }

    public enum TemplateStatus {
        DRAFT,                  // Being edited
        PUBLISHED,              // Active and can be used
        ARCHIVED                // Archived, cannot be used
    }

    // Helper methods
    public boolean isActive() {
        return status == TemplateStatus.PUBLISHED;
    }

    public void publish(Long publishedBy) {
        this.status = TemplateStatus.PUBLISHED;
        this.publishedBy = publishedBy;
        this.publishedAt = LocalDateTime.now();
    }

    public void archive() {
        this.status = TemplateStatus.ARCHIVED;
    }
}
