package com.dlp.platform.repository;

import com.dlp.platform.entity.WorkflowTemplate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WorkflowTemplateRepository extends JpaRepository<WorkflowTemplate, Long> {

    /**
     * Find published templates
     */
    @Query("SELECT w FROM WorkflowTemplate w WHERE w.status = 'PUBLISHED' ORDER BY w.name ASC")
    List<WorkflowTemplate> findPublishedTemplates();

    /**
     * Find templates by workflow type
     */
    List<WorkflowTemplate> findByWorkflowTypeAndStatus(WorkflowTemplate.WorkflowType workflowType, WorkflowTemplate.TemplateStatus status);

    /**
     * Find templates by creator
     */
    Page<WorkflowTemplate> findByCreatedBy(Long createdBy, Pageable pageable);

    /**
     * Find latest version of template by name.
     * Use Pageable with size=1 and take the first element from the returned Page.
     */
    @Query("SELECT w FROM WorkflowTemplate w WHERE w.name = :name AND w.status = 'PUBLISHED' ORDER BY w.version DESC")
    Page<WorkflowTemplate> findLatestVersionByName(@Param("name") String name, Pageable pageable);

    /**
     * Find all versions of a template by name
     */
    List<WorkflowTemplate> findByNameOrderByVersionDesc(String name);

    /**
     * Check if template name exists
     */
    boolean existsByNameAndStatus(String name, WorkflowTemplate.TemplateStatus status);

    /**
     * Find templates by status
     */
    Page<WorkflowTemplate> findByStatus(WorkflowTemplate.TemplateStatus status, Pageable pageable);
}
