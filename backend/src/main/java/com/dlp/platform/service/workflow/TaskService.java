package com.dlp.platform.service.workflow;

import com.dlp.platform.dto.workflow.TaskActionRequest;
import com.dlp.platform.dto.workflow.TaskResponse;
import com.dlp.platform.entity.Task;
import com.dlp.platform.entity.User;
import com.dlp.platform.entity.WorkflowInstance;
import com.dlp.platform.repository.TaskRepository;
import com.dlp.platform.repository.UserRepository;
import com.dlp.platform.repository.WorkflowInstanceRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.dlp.platform.util.RoleUtils;
import com.dlp.platform.service.audit.AuditLogService;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Service for managing workflow tasks and approvals
 *
 * Features:
 * - Task approval/rejection
 * - Task delegation
 * - Reminder management
 * - Digital signature support
 * - Full audit trail
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class TaskService {

    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final WorkflowInstanceRepository workflowInstanceRepository;
    private final AuditLogService auditLogService;

    /**
     * Get all pending tasks for a user
     */
    @Transactional(readOnly = true)
    public List<TaskResponse> getUserPendingTasks(User currentUser) {
        List<Task> tasks = taskRepository.findPendingTasksByAssignee(currentUser.getId());
        return tasks.stream()
            .map(this::enrichTaskResponse)
            .collect(Collectors.toList());
    }

    /**
     * Get all tasks assigned to a user (paginated)
     */
    @Transactional(readOnly = true)
    public Page<TaskResponse> getUserTasks(User currentUser, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<Task> tasks = taskRepository.findByAssigneeId(currentUser.getId(), pageable);
        return tasks.map(this::enrichTaskResponse);
    }

    /**
     * Get task details
     */
    @Transactional(readOnly = true)
    public TaskResponse getTask(Long taskId, User currentUser) {
        Task task = taskRepository.findById(taskId)
            .orElseThrow(() -> new EntityNotFoundException("Task not found"));

        // Verify user can view this task
        if (!canViewTask(task, currentUser)) {
            throw new AccessDeniedException("You do not have permission to view this task");
        }

        return enrichTaskResponse(task);
    }

    /**
     * Process task action (approve/reject/delegate)
     */
    @Transactional
    public TaskResponse processTaskAction(Long taskId, TaskActionRequest request, User currentUser, String ipAddress) {
        log.info("Processing task action {} for task {} by user {}",
            request.getAction(), taskId, currentUser.getAccountId());

        Task task = taskRepository.findById(taskId)
            .orElseThrow(() -> new EntityNotFoundException("Task not found"));

        switch (request.getAction()) {
            case APPROVE:
                return approveTask(task, request, currentUser, ipAddress);
            case REJECT:
                return rejectTask(task, request, currentUser, ipAddress);
            case DELEGATE:
                return delegateTask(task, request, currentUser, ipAddress);
            default:
                throw new IllegalArgumentException("Unknown action: " + request.getAction());
        }
    }

    /**
     * Approve a task
     */
    private TaskResponse approveTask(Task task, TaskActionRequest request, User currentUser, String ipAddress) {
        // Approve method validates permissions internally
        task.approve(currentUser.getId(), request.getComment(), request.getSignature());
        Task savedTask = taskRepository.save(task);

        // Advance workflow if applicable
        if (task.getWorkflowInstanceId() != null) {
            advanceWorkflow(task.getWorkflowInstanceId(), true);
        }

        // Audit log
        auditLogService.log(
            currentUser.getId(),
            "TASK_APPROVED",
            "Task",
            task.getId().toString(),
            ipAddress,
            "Task approved: " + task.getTitle()
        );

        log.info("Task approved successfully: {}", task.getId());
        return enrichTaskResponse(savedTask);
    }

    /**
     * Reject a task
     */
    private TaskResponse rejectTask(Task task, TaskActionRequest request, User currentUser, String ipAddress) {
        // Reject method validates permissions internally
        task.reject(currentUser.getId(), request.getComment());
        Task savedTask = taskRepository.save(task);

        // Handle workflow rejection
        if (task.getWorkflowInstanceId() != null) {
            advanceWorkflow(task.getWorkflowInstanceId(), false);
        }

        // Audit log
        auditLogService.log(
            currentUser.getId(),
            "TASK_REJECTED",
            "Task",
            task.getId().toString(),
            ipAddress,
            "Task rejected: " + task.getTitle()
        );

        log.info("Task rejected: {}", task.getId());
        return enrichTaskResponse(savedTask);
    }

    /**
     * Delegate a task to another user
     */
    private TaskResponse delegateTask(Task task, TaskActionRequest request, User currentUser, String ipAddress) {
        if (request.getDelegateToUserId() == null) {
            throw new IllegalArgumentException("Delegate target user ID is required");
        }

        User targetUser = userRepository.findById(request.getDelegateToUserId())
            .orElseThrow(() -> new EntityNotFoundException("Target user not found"));

        // Delegate method validates permissions internally
        task.delegate(currentUser.getId(), targetUser.getId(), request.getComment());
        task.setAssigneeName(targetUser.getFullName());
        Task savedTask = taskRepository.save(task);

        // Audit log
        auditLogService.log(
            currentUser.getId(),
            "TASK_DELEGATED",
            "Task",
            task.getId().toString(),
            ipAddress,
            "Task delegated to: " + targetUser.getFullName()
        );

        log.info("Task delegated to user {}", targetUser.getAccountId());
        return enrichTaskResponse(savedTask);
    }

    /**
     * Send reminder for overdue tasks
     */
    @Transactional
    public void sendReminders() {
        log.info("Sending reminders for overdue tasks");

        LocalDateTime threshold = LocalDateTime.now().minusHours(24);
        List<Task> tasks = taskRepository.findTasksRequiringReminder(threshold, 3);

        for (Task task : tasks) {
            task.sendReminder();
            taskRepository.save(task);

            // In production, send actual email/notification
            log.info("Reminder sent for task {}: {}", task.getId(), task.getTitle());
        }

        log.info("Reminders sent for {} tasks", tasks.size());
    }

    /**
     * Get overdue tasks
     */
    @Transactional(readOnly = true)
    public List<TaskResponse> getOverdueTasks() {
        List<Task> tasks = taskRepository.findOverdueTasks(LocalDateTime.now());
        return tasks.stream()
            .map(this::enrichTaskResponse)
            .collect(Collectors.toList());
    }

    /**
     * Escalate overdue tasks after N days
     * - Escalates to supervisor or next level approver
     * - Updates urgency level
     * - Sends notifications
     */
    @Transactional
    public Map<String, Object> escalateOverdueTasks(int daysOverdue) {
        log.info("Escalating tasks overdue for more than {} days", daysOverdue);
        
        LocalDateTime threshold = LocalDateTime.now().minusDays(daysOverdue);
        List<Task> overdueTasks = taskRepository.findOverdueTasks(threshold);
        
        int escalated = 0;
        int autoRejected = 0;
        
        for (Task task : overdueTasks) {
            try {
                // Check if task is severely overdue (more than 2x the threshold)
                long daysPastDue = java.time.Duration.between(
                    task.getDueDate() != null ? task.getDueDate() : task.getCreatedAt(),
                    LocalDateTime.now()
                ).toDays();
                
                if (daysPastDue > daysOverdue * 2) {
                    // Auto-reject severely overdue tasks
                    task.setStatus(Task.TaskStatus.COMPLETED);
                    task.setDecision(Task.TaskDecision.REJECTED);
                    task.setComment("Auto-rejected: Task exceeded deadline by more than " + (daysOverdue * 2) + " days");
                    task.setCompletedAt(LocalDateTime.now());
                    taskRepository.save(task);
                    autoRejected++;
                    
                    log.info("Auto-rejected severely overdue task: {}", task.getId());
                } else {
                    // Escalate to higher urgency
                    if (task.getUrgencyLevel() == Task.UrgencyLevel.LOW) {
                        task.setUrgencyLevel(Task.UrgencyLevel.NORMAL);
                    } else if (task.getUrgencyLevel() == Task.UrgencyLevel.NORMAL) {
                        task.setUrgencyLevel(Task.UrgencyLevel.HIGH);
                    } else if (task.getUrgencyLevel() == Task.UrgencyLevel.HIGH) {
                        task.setUrgencyLevel(Task.UrgencyLevel.CRITICAL);
                    }
                    
                    // Send reminder
                    task.sendReminder();
                    taskRepository.save(task);
                    escalated++;
                    
                    log.info("Escalated task {} to urgency level {}", task.getId(), task.getUrgencyLevel());
                }
            } catch (Exception e) {
                log.error("Error escalating task {}", task.getId(), e);
            }
        }
        
        Map<String, Object> result = new HashMap<>();
        result.put("escalated", escalated);
        result.put("autoRejected", autoRejected);
        result.put("totalProcessed", overdueTasks.size());
        
        log.info("Escalation complete: {} escalated, {} auto-rejected", escalated, autoRejected);
        return result;
    }

    /**
     * Count pending tasks for a user
     */
    @Transactional(readOnly = true)
    public long countUserPendingTasks(User currentUser) {
        return taskRepository.countPendingTasksByAssignee(currentUser.getId());
    }

    // Helper methods

    private boolean canViewTask(Task task, User user) {
        // Assignee can view
        if (task.getAssigneeId().equals(user.getId())) {
            return true;
        }

        // Applicant can view
        if (task.getApplicantId().equals(user.getId())) {
            return true;
        }

        // Admins can view all
        return RoleUtils.isAdmin(user.getRoles());
    }

    private void advanceWorkflow(Long workflowInstanceId, boolean approved) {
        WorkflowInstance workflow = workflowInstanceRepository.findById(workflowInstanceId).orElse(null);
        if (workflow == null) {
            return;
        }

        if (!approved) {
            // Workflow rejected
            workflow.complete(WorkflowInstance.WorkflowDecision.REJECTED, null, "Task rejected in workflow");
            workflowInstanceRepository.save(workflow);
            return;
        }

        // Check if this was the last step
        if (workflow.isLastStep()) {
            workflow.complete(WorkflowInstance.WorkflowDecision.APPROVED, null, "All tasks approved");
            workflowInstanceRepository.save(workflow);
        } else {
            // Advance to next step
            workflow.advanceStep();
            workflowInstanceRepository.save(workflow);

            // Create next task (would need workflow engine here)
            log.info("Workflow advanced to step {}/{}", workflow.getCurrentStep(), workflow.getTotalSteps());
        }
    }

    private TaskResponse enrichTaskResponse(Task task) {
        TaskResponse response = TaskResponse.from(task);

        // Enrich with user names if not already set
        if (response.getApplicantName() == null && task.getApplicantId() != null) {
            userRepository.findById(task.getApplicantId()).ifPresent(user ->
                response.setApplicantName(user.getFullName())
            );
        }

        if (response.getAssigneeName() == null && task.getAssigneeId() != null) {
            userRepository.findById(task.getAssigneeId()).ifPresent(user ->
                response.setAssigneeName(user.getFullName())
            );
        }

        return response;
    }
}
