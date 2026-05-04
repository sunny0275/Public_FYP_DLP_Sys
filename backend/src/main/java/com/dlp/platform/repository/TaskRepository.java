package com.dlp.platform.repository;

import com.dlp.platform.entity.Task;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {

    /**
     * Find all tasks assigned to a user
     */
    Page<Task> findByAssigneeId(Long assigneeId, Pageable pageable);

    /**
     * Find pending tasks for a user
     */
    @Query("SELECT t FROM Task t WHERE t.assigneeId = :assigneeId AND t.status = 'PENDING' ORDER BY t.createdAt DESC")
    List<Task> findPendingTasksByAssignee(@Param("assigneeId") Long assigneeId);

    /**
     * Find tasks by applicant
     */
    Page<Task> findByApplicantId(Long applicantId, Pageable pageable);

    /**
     * Find tasks by workflow instance
     */
    List<Task> findByWorkflowInstanceIdOrderByCreatedAtAsc(Long workflowInstanceId);

    /**
     * Find tasks by document
     */
    List<Task> findByDocumentIdOrderByCreatedAtDesc(Long documentId);

    /**
     * Find overdue tasks
     */
    @Query("SELECT t FROM Task t WHERE t.dueDate < :now AND t.status = 'PENDING'")
    List<Task> findOverdueTasks(@Param("now") LocalDateTime now);

    /**
     * Find tasks by status
     */
    Page<Task> findByStatus(Task.TaskStatus status, Pageable pageable);

    /**
     * Find tasks by urgency level
     */
    @Query("SELECT t FROM Task t WHERE t.urgencyLevel = :urgencyLevel AND t.status = 'PENDING' ORDER BY t.createdAt ASC")
    List<Task> findByUrgencyLevel(@Param("urgencyLevel") Task.UrgencyLevel urgencyLevel);

    /**
     * Count pending tasks for a user
     */
    @Query("SELECT COUNT(t) FROM Task t WHERE t.assigneeId = :assigneeId AND t.status = 'PENDING'")
    long countPendingTasksByAssignee(@Param("assigneeId") Long assigneeId);

    /**
     * Find tasks requiring reminder (pending for > N hours with < M reminders)
     */
    @Query("SELECT t FROM Task t WHERE t.status = 'PENDING' AND t.createdAt < :threshold AND (t.reminderCount IS NULL OR t.reminderCount < :maxReminders)")
    List<Task> findTasksRequiringReminder(@Param("threshold") LocalDateTime threshold, @Param("maxReminders") int maxReminders);

    /**
     * Find tasks by assignee and status
     */
    @Query("SELECT t FROM Task t WHERE t.assigneeId = :assigneeId AND t.status IN :statuses ORDER BY t.createdAt DESC")
    Page<Task> findByAssigneeIdAndStatusIn(@Param("assigneeId") Long assigneeId, @Param("statuses") List<Task.TaskStatus> statuses, Pageable pageable);
}
