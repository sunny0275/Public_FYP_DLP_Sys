package com.dlp.platform.repository;

import com.dlp.platform.entity.WorkflowInstance;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface WorkflowInstanceRepository extends JpaRepository<WorkflowInstance, Long> {

    /**
     * Find workflows by initiator
     */
    Page<WorkflowInstance> findByInitiatorIdOrderByCreatedAtDesc(Long initiatorId, Pageable pageable);

    /**
     * Find workflows by document
     */
    List<WorkflowInstance> findByDocumentIdOrderByCreatedAtDesc(Long documentId);

    /**
     * Find workflows by share link
     */
    List<WorkflowInstance> findByShareIdOrderByCreatedAtDesc(Long shareId);

    /**
     * Find workflows by status
     */
    Page<WorkflowInstance> findByStatusOrderByCreatedAtDesc(WorkflowInstance.WorkflowStatus status, Pageable pageable);

    /**
     * Find active workflows (PENDING or RUNNING)
     */
    @Query("SELECT w FROM WorkflowInstance w WHERE w.status IN ('PENDING', 'RUNNING') ORDER BY w.createdAt ASC")
    List<WorkflowInstance> findActiveWorkflows();

    /**
     * Find workflows by template
     */
    Page<WorkflowInstance> findByTemplateIdOrderByCreatedAtDesc(Long templateId, Pageable pageable);

    /**
     * Count active workflows for a document
     */
    @Query("SELECT COUNT(w) FROM WorkflowInstance w WHERE w.documentId = :documentId AND w.status IN ('PENDING', 'RUNNING')")
    long countActiveWorkflowsForDocument(@Param("documentId") Long documentId);

    /**
     * Find workflows initiated in time range
     */
    @Query("SELECT w FROM WorkflowInstance w WHERE w.startedAt BETWEEN :startDate AND :endDate ORDER BY w.startedAt DESC")
    Page<WorkflowInstance> findByDateRange(@Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate, Pageable pageable);

    /**
     * Find stalled workflows (running but no activity for N hours)
     */
    @Query("SELECT w FROM WorkflowInstance w WHERE w.status = 'RUNNING' AND w.updatedAt < :threshold")
    List<WorkflowInstance> findStalledWorkflows(@Param("threshold") LocalDateTime threshold);

    /**
     * Count workflows by template and status (for template safety checks)
     */
    long countByTemplateIdAndStatus(Long templateId, WorkflowInstance.WorkflowStatus status);
}
