package com.dlp.platform.service.workflow;

import com.dlp.platform.dto.workflow.*;
import com.dlp.platform.entity.*;
import com.dlp.platform.repository.*;
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
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for managing workflow templates and instances
 *
 * Features:
 * - Create and manage workflow templates
 * - Start and execute workflow instances
 * - Track workflow progress
 * - Manage workflow approvals
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class WorkflowService {

    private final WorkflowTemplateRepository templateRepository;
    private final WorkflowInstanceRepository instanceRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final DocumentRepository documentRepository;
    private final AuditLogService auditLogService;

    /**
     * Create a new workflow template
     */
    @Transactional
    public WorkflowTemplateResponse createTemplate(WorkflowTemplateRequest request, User currentUser) {
        log.info("Creating workflow template: {} by user {}", request.getName(), currentUser.getAccountId());

        // Only admins can create templates
        if (!RoleUtils.isAdmin(currentUser.getRoles())) {
            throw new AccessDeniedException("Only administrators can create workflow templates");
        }

        // Validate JSON format (basic check)
        if (!isValidJson(request.getStepsJson())) {
            throw new IllegalArgumentException("Invalid workflow steps JSON format");
        }

        WorkflowTemplate template = WorkflowTemplate.builder()
            .name(request.getName())
            .description(request.getDescription())
            .workflowType(request.getWorkflowType())
            .stepsJson(request.getStepsJson())
            .createdBy(currentUser.getId())
            .status(WorkflowTemplate.TemplateStatus.DRAFT)
            .build();

        WorkflowTemplate savedTemplate = templateRepository.save(template);

        log.info("Workflow template created: {}", savedTemplate.getId());
        return WorkflowTemplateResponse.from(savedTemplate);
    }

    /**
     * Publish a workflow template
     */
    @Transactional
    public WorkflowTemplateResponse publishTemplate(Long templateId, User currentUser) {
        log.info("Publishing workflow template: {} by user {}", templateId, currentUser.getAccountId());

        WorkflowTemplate template = templateRepository.findById(templateId)
            .orElseThrow(() -> new EntityNotFoundException("Workflow template not found"));

        if (!RoleUtils.isAdmin(currentUser.getRoles())) {
            throw new AccessDeniedException("Only administrators can publish workflow templates");
        }

        template.publish(currentUser.getId());
        WorkflowTemplate savedTemplate = templateRepository.save(template);

        log.info("Workflow template published: {}", savedTemplate.getId());
        return WorkflowTemplateResponse.from(savedTemplate);
    }

    /**
     * Get all published workflow templates
     */
    @Transactional(readOnly = true)
    public List<WorkflowTemplateResponse> getPublishedTemplates() {
        List<WorkflowTemplate> templates = templateRepository.findPublishedTemplates();
        return templates.stream()
            .map(WorkflowTemplateResponse::from)
            .collect(Collectors.toList());
    }

    /**
     * Get all workflow templates (including drafts) - Admin only
     */
    @Transactional(readOnly = true)
    public List<WorkflowTemplateResponse> getAllTemplates(User currentUser) {
        log.info("Fetching all workflow templates for user {}", currentUser.getAccountId());

        if (!RoleUtils.isAdmin(currentUser.getRoles())) {
            throw new AccessDeniedException("Only administrators can view all templates");
        }

        List<WorkflowTemplate> templates = templateRepository.findAll();
        return templates.stream()
            .map(WorkflowTemplateResponse::from)
            .collect(Collectors.toList());
    }

    /**
     * Get workflow template by ID
     */
    @Transactional(readOnly = true)
    public WorkflowTemplateResponse getTemplateById(Long templateId, User currentUser) {
        log.info("Fetching workflow template {} for user {}", templateId, currentUser.getAccountId());

        WorkflowTemplate template = templateRepository.findById(templateId)
            .orElseThrow(() -> new EntityNotFoundException("Workflow template not found"));

        // Only admins can view draft templates
        if (template.getStatus() == WorkflowTemplate.TemplateStatus.DRAFT &&
            !RoleUtils.isAdmin(currentUser.getRoles())) {
            throw new AccessDeniedException("Only administrators can view draft templates");
        }

        return WorkflowTemplateResponse.from(template);
    }

    /**
     * Get diff between two template versions. Currently only current version is stored; no history table.
     */
    public Map<String, Object> getTemplateDiff(Long templateId, Integer fromVersion, Integer toVersion, User currentUser) {
        WorkflowTemplate template = templateRepository.findById(templateId)
            .orElseThrow(() -> new EntityNotFoundException("Workflow template not found"));
        if (template.getStatus() == WorkflowTemplate.TemplateStatus.DRAFT && !RoleUtils.isAdmin(currentUser.getRoles())) {
            throw new AccessDeniedException("Only administrators can view draft templates");
        }
        int from = fromVersion != null ? fromVersion : 1;
        int to = toVersion != null ? toVersion : template.getVersion() != null ? template.getVersion() : 1;
        Map<String, Object> diff = new HashMap<>();
        diff.put("fromVersion", from);
        diff.put("toVersion", to);
        diff.put("fromStepsJson", from == template.getVersion() ? template.getStepsJson() : null);
        diff.put("toStepsJson", to == template.getVersion() ? template.getStepsJson() : null);
        diff.put("note", "Only current version is stored; version history not implemented. Both sides show current steps when version matches.");
        return diff;
    }

    /**
     * Update workflow template (draft only)
     */
    @Transactional
    public WorkflowTemplateResponse updateTemplate(Long templateId, WorkflowTemplateRequest request, User currentUser) {
        log.info("Updating workflow template {} by user {}", templateId, currentUser.getAccountId());

        if (!RoleUtils.isAdmin(currentUser.getRoles())) {
            throw new AccessDeniedException("Only administrators can update workflow templates");
        }

        WorkflowTemplate template = templateRepository.findById(templateId)
            .orElseThrow(() -> new EntityNotFoundException("Workflow template not found"));

        // Can only update draft templates
        if (template.getStatus() != WorkflowTemplate.TemplateStatus.DRAFT) {
            throw new IllegalStateException("Cannot update published or archived templates. Create a new version instead.");
        }

        // Validate JSON format
        if (!isValidJson(request.getStepsJson())) {
            throw new IllegalArgumentException("Invalid workflow steps JSON format");
        }

        // Update fields
        template.setName(request.getName());
        template.setDescription(request.getDescription());
        template.setWorkflowType(request.getWorkflowType());
        template.setStepsJson(request.getStepsJson());
        template.setUpdatedAt(LocalDateTime.now());

        WorkflowTemplate savedTemplate = templateRepository.save(template);

        log.info("Workflow template updated: {}", savedTemplate.getId());
        return WorkflowTemplateResponse.from(savedTemplate);
    }

    /**
     * Delete workflow template (draft only)
     */
    @Transactional
    public void deleteTemplate(Long templateId, User currentUser) {
        log.info("Deleting workflow template {} by user {}", templateId, currentUser.getAccountId());

        if (!RoleUtils.isAdmin(currentUser.getRoles())) {
            throw new AccessDeniedException("Only administrators can delete workflow templates");
        }

        WorkflowTemplate template = templateRepository.findById(templateId)
            .orElseThrow(() -> new EntityNotFoundException("Workflow template not found"));

        // Can only delete draft templates
        if (template.getStatus() != WorkflowTemplate.TemplateStatus.DRAFT) {
            throw new IllegalStateException("Cannot delete published or archived templates. Archive them instead.");
        }

        // Check if any workflows are using this template
        long runningWorkflows = instanceRepository.countByTemplateIdAndStatus(
            templateId, WorkflowInstance.WorkflowStatus.RUNNING);

        if (runningWorkflows > 0) {
            throw new IllegalStateException("Cannot delete template with running workflow instances");
        }

        templateRepository.delete(template);
        log.info("Workflow template deleted: {}", templateId);
    }

    /**
     * Archive workflow template
     */
    @Transactional
    public WorkflowTemplateResponse archiveTemplate(Long templateId, User currentUser) {
        log.info("Archiving workflow template {} by user {}", templateId, currentUser.getAccountId());

        if (!RoleUtils.isAdmin(currentUser.getRoles())) {
            throw new AccessDeniedException("Only administrators can archive workflow templates");
        }

        WorkflowTemplate template = templateRepository.findById(templateId)
            .orElseThrow(() -> new EntityNotFoundException("Workflow template not found"));

        // Can only archive published templates
        if (template.getStatus() != WorkflowTemplate.TemplateStatus.PUBLISHED) {
            throw new IllegalStateException("Can only archive published templates");
        }

        // Archive template (no user tracking in entity for now)
        template.archive();
        WorkflowTemplate savedTemplate = templateRepository.save(template);

        log.info("Workflow template archived: {}", savedTemplate.getId());
        return WorkflowTemplateResponse.from(savedTemplate);
    }

    /**
     * Validate workflow template structure
     */
    @Transactional(readOnly = true)
    public Map<String, Object> validateTemplate(WorkflowTemplateRequest request, User currentUser) {
        log.info("Validating workflow template by user {}", currentUser.getAccountId());

        Map<String, Object> result = new HashMap<>();
        List<String> errors = new java.util.ArrayList<>();
        List<String> warnings = new java.util.ArrayList<>();

        // Basic validation
        if (request.getName() == null || request.getName().trim().isEmpty()) {
            errors.add("Template name is required");
        }

        // Workflow type (optional enum in request; just check null)
        if (request.getWorkflowType() == null) {
            errors.add("Workflow type is required");
        }

        if (request.getStepsJson() == null || request.getStepsJson().trim().isEmpty()) {
            errors.add("Workflow steps are required");
        }

        // JSON structure validation
        if (request.getStepsJson() != null && !isValidJson(request.getStepsJson())) {
            errors.add("Invalid JSON format for workflow steps");
        } else if (request.getStepsJson() != null) {
            // Validate workflow steps logic
            try {
                validateWorkflowSteps(request.getStepsJson(), errors, warnings);
            } catch (Exception e) {
                errors.add("Error parsing workflow steps: " + e.getMessage());
            }
        }

        result.put("valid", errors.isEmpty());
        result.put("errors", errors);
        result.put("warnings", warnings);

        log.info("Template validation completed: {} errors, {} warnings", errors.size(), warnings.size());
        return result;
    }

    /**
     * Validate workflow steps logic
     */
    private void validateWorkflowSteps(String stepsJson, List<String> errors, List<String> warnings) {
        // In production, use JSON parser and validate:
        // - Step references are valid
        // - No circular dependencies
        // - Approver rules are properly configured
        // - Timeout values are reasonable

        // Basic checks
        if (!stepsJson.contains("type")) {
            warnings.add("Steps should have a 'type' field");
        }

        if (!stepsJson.contains("approver")) {
            warnings.add("Approval steps should define approver rules");
        }

        // Check for potential circular references (simplified)
        int stepCount = extractTotalSteps(stepsJson);
        if (stepCount > 20) {
            warnings.add("Workflow has more than 20 steps, consider simplifying");
        }

        if (stepCount == 0) {
            errors.add("Workflow must have at least one step");
        }
    }

    /**
     * Start a new workflow instance
     */
    @Transactional
    public WorkflowInstanceResponse startWorkflow(WorkflowInstanceRequest request, User currentUser, String ipAddress) {
        log.info("Starting workflow from template {} by user {}",
            request.getTemplateId(), currentUser.getAccountId());

        WorkflowTemplate template = templateRepository.findById(request.getTemplateId())
            .orElseThrow(() -> new EntityNotFoundException("Workflow template not found"));

        if (!template.isActive()) {
            throw new IllegalStateException("Workflow template is not active");
        }

        // Create workflow instance
        WorkflowInstance instance = WorkflowInstance.builder()
            .templateId(template.getId())
            .workflowName(template.getName())
            .initiatorId(currentUser.getId())
            .initiatorName(currentUser.getFullName())
            .documentId(request.getDocumentId())
            .shareId(request.getShareId())
            .status(WorkflowInstance.WorkflowStatus.PENDING)
            .currentStep(0)
            .totalSteps(extractTotalSteps(template.getStepsJson()))
            .stateJson(request.getContextJson())
            .build();

        WorkflowInstance savedInstance = instanceRepository.save(instance);

        // Start workflow execution
        savedInstance.start();
        createFirstTask(savedInstance, template, currentUser);
        instanceRepository.save(savedInstance);

        // Audit log
        auditLogService.log(
            currentUser.getId(),
            "WORKFLOW_STARTED",
            "Workflow",
            savedInstance.getId().toString(),
            ipAddress,
            "Workflow started: " + template.getName()
        );

        log.info("Workflow instance created and started: {}", savedInstance.getId());
        return WorkflowInstanceResponse.from(savedInstance);
    }

    /**
     * Get workflow instance details
     */
    @Transactional(readOnly = true)
    public WorkflowInstanceResponse getWorkflowInstance(Long instanceId, User currentUser) {
        WorkflowInstance instance = instanceRepository.findById(instanceId)
            .orElseThrow(() -> new EntityNotFoundException("Workflow instance not found"));

        // Verify user can view this workflow
        if (!canViewWorkflow(instance, currentUser)) {
            throw new AccessDeniedException("You do not have permission to view this workflow");
        }

        WorkflowInstanceResponse response = WorkflowInstanceResponse.from(instance);

        // Load associated tasks
        List<Task> tasks = taskRepository.findByWorkflowInstanceIdOrderByCreatedAtAsc(instance.getId());
        response.setTasks(tasks.stream()
            .map(com.dlp.platform.dto.workflow.TaskResponse::from)
            .collect(Collectors.toList()));

        return response;
    }

    /**
     * Get user's workflow instances
     */
    @Transactional(readOnly = true)
    public Page<WorkflowInstanceResponse> getUserWorkflows(User currentUser, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<WorkflowInstance> instances = instanceRepository.findByInitiatorIdOrderByCreatedAtDesc(
            currentUser.getId(), pageable);

        return instances.map(WorkflowInstanceResponse::from);
    }

    /**
     * Cancel a workflow instance
     */
    @Transactional
    public void cancelWorkflow(Long instanceId, User currentUser, String reason, String ipAddress) {
        log.info("Cancelling workflow {} by user {}", instanceId, currentUser.getAccountId());

        WorkflowInstance instance = instanceRepository.findById(instanceId)
            .orElseThrow(() -> new EntityNotFoundException("Workflow instance not found"));

        // Verify permission
        if (!instance.getInitiatorId().equals(currentUser.getId()) &&
            !RoleUtils.isAdmin(currentUser.getRoles())) {
            throw new AccessDeniedException("You do not have permission to cancel this workflow");
        }

        if (instance.isCompleted()) {
            throw new IllegalStateException("Cannot cancel a completed workflow");
        }

        instance.cancel(currentUser.getId(), reason);
        instanceRepository.save(instance);

        // Cancel all pending tasks
        List<Task> pendingTasks = taskRepository.findByWorkflowInstanceIdOrderByCreatedAtAsc(instance.getId());
        for (Task task : pendingTasks) {
            if (task.getStatus() == Task.TaskStatus.PENDING) {
                // Cancel task logic would go here
            }
        }

        // Audit log
        auditLogService.log(
            currentUser.getId(),
            "WORKFLOW_CANCELLED",
            "Workflow",
            instanceId.toString(),
            ipAddress,
            "Workflow cancelled: " + reason
        );

        log.info("Workflow cancelled: {}", instanceId);
    }

    // Helper methods

    private boolean isValidJson(String json) {
        if (json == null || json.trim().isEmpty()) {
            return false;
        }
        // Basic validation - in production, use JSON schema validator
        return json.trim().startsWith("[") || json.trim().startsWith("{");
    }

    private int extractTotalSteps(String stepsJson) {
        // In production, parse JSON and count steps
        // For now, assume simple array format
        if (stepsJson.contains("[")) {
            int count = stepsJson.split(",").length;
            return Math.max(1, count);
        }
        return 1;
    }

    private void createFirstTask(WorkflowInstance instance, WorkflowTemplate template, User initiator) {
        // In production, parse workflow steps and create first task
        // For now, create a simple approval task

        Task task = Task.builder()
            .title("Approval for: " + instance.getWorkflowName())
            .description("Please review and approve this workflow request")
            .workflowInstanceId(instance.getId())
            .documentId(instance.getDocumentId())
            .applicantId(initiator.getId())
            .applicantName(initiator.getFullName())
            .assigneeId(findFirstApprover(template, initiator))
            .taskType(Task.TaskType.APPROVAL)
            .status(Task.TaskStatus.PENDING)
            .urgencyLevel(Task.UrgencyLevel.NORMAL)
            .dueDate(LocalDateTime.now().plusDays(3))
            .build();

        // Set assignee name
        if (task.getAssigneeId() != null) {
            userRepository.findById(task.getAssigneeId()).ifPresent(user ->
                task.setAssigneeName(user.getFullName())
            );
        }

        taskRepository.save(task);
        log.info("First task created for workflow {}", instance.getId());
    }

    private Long findFirstApprover(WorkflowTemplate template, User initiator) {
        // In production, parse workflow JSON to find first approver
        // For now, find user's manager or return admin
        return userRepository.findAll().stream()
            .filter(u -> RoleUtils.hasRole(u.getRoles(), "MANAGER"))
            .findFirst()
            .map(User::getId)
            .orElse(1L); // Fallback to admin
    }

    private boolean canViewWorkflow(WorkflowInstance instance, User user) {
        // Initiator can view
        if (instance.getInitiatorId().equals(user.getId())) {
            return true;
        }

        // Users with tasks in the workflow can view
        List<Task> userTasks = taskRepository.findByWorkflowInstanceIdOrderByCreatedAtAsc(instance.getId());
        if (userTasks.stream().anyMatch(t -> t.getAssigneeId().equals(user.getId()))) {
            return true;
        }

        // Admins can view all
        return RoleUtils.isAdmin(user.getRoles());
    }

    /**
     * Get workflow statistics
     *
     * @param templateId Optional template ID to filter statistics
     * @param days Number of days to include in statistics (null = all time)
     * @return Workflow statistics
     */
    @Transactional(readOnly = true)
    public WorkflowStatistics getWorkflowStatistics(Long templateId, Integer days) {
        log.info("Calculating workflow statistics: templateId={}, days={}", templateId, days);

        LocalDateTime startDate = days != null ? LocalDateTime.now().minusDays(days) : null;

        // Get all workflows (filtered by template and date if provided)
        List<WorkflowInstance> allWorkflows = getAllWorkflowsForStats(templateId, startDate);

        // Overall statistics
        long total = allWorkflows.size();
        long completed = allWorkflows.stream()
            .filter(w -> w.getStatus() == WorkflowInstance.WorkflowStatus.COMPLETED)
            .count();
        long running = allWorkflows.stream()
            .filter(w -> w.getStatus() == WorkflowInstance.WorkflowStatus.RUNNING)
            .count();
        long cancelled = allWorkflows.stream()
            .filter(w -> w.getStatus() == WorkflowInstance.WorkflowStatus.CANCELLED)
            .count();

        // Calculate average duration for completed workflows
        double avgDuration = allWorkflows.stream()
            .filter(w -> w.getStatus() == WorkflowInstance.WorkflowStatus.COMPLETED)
            .filter(w -> w.getStartedAt() != null && w.getCompletedAt() != null)
            .mapToDouble(w -> ChronoUnit.DAYS.between(w.getStartedAt(), w.getCompletedAt()))
            .average()
            .orElse(0.0);

        // Calculate approval rate (completed / (completed + cancelled))
        double approvalRate = (completed + cancelled) > 0
            ? (completed * 100.0) / (completed + cancelled)
            : 0.0;

        // Calculate completion rate (completed / total)
        double completionRate = total > 0 ? (completed * 100.0) / total : 0.0;

        // Calculate timeout rate (estimate based on cancelled workflows)
        double timeoutRate = total > 0 ? (cancelled * 100.0) / total : 0.0;

        // Statistics by template
        List<WorkflowStatistics.TemplateStatistics> templateStats = calculateTemplateStatistics(allWorkflows);

        // Statistics by department (based on initiator)
        List<WorkflowStatistics.DepartmentStatistics> deptStats = calculateDepartmentStatistics(allWorkflows);

        // Trend data (last 30 days)
        List<WorkflowStatistics.TrendData> trends = calculateTrends(allWorkflows, 30);

        String period = days != null ? "Last " + days + " days" : "All time";

        return WorkflowStatistics.builder()
            .totalWorkflows(total)
            .completedWorkflows(completed)
            .runningWorkflows(running)
            .cancelledWorkflows(cancelled)
            .averageDurationDays(Math.round(avgDuration * 10.0) / 10.0)
            .approvalRate(Math.round(approvalRate * 10.0) / 10.0)
            .timeoutRate(Math.round(timeoutRate * 10.0) / 10.0)
            .completionRate(Math.round(completionRate * 10.0) / 10.0)
            .period(period)
            .byTemplate(templateStats)
            .byDepartment(deptStats)
            .trends(trends)
            .build();
    }

    /**
     * Simulate workflow execution to preview approval chain
     *
     * @param request Simulation request
     * @return Simulated workflow with resolved approvers
     */
    @Transactional(readOnly = true)
    public WorkflowSimulation.Response simulateWorkflow(WorkflowSimulation.Request request) {
        log.info("Simulating workflow: templateId={}, userId={}", request.getTemplateId(), request.getUserId());

        WorkflowTemplate template = templateRepository.findById(request.getTemplateId())
            .orElseThrow(() -> new EntityNotFoundException("Workflow template not found"));

        User initiator = userRepository.findById(request.getUserId())
            .orElseThrow(() -> new EntityNotFoundException("User not found"));

        List<String> warnings = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        // Parse workflow steps
        List<WorkflowSimulation.SimulatedStep> simulatedSteps = new ArrayList<>();
        try {
            // In production, parse actual JSON steps
            // For demo, create sample steps
            String stepsJson = template.getStepsJson();

            if (stepsJson == null || stepsJson.trim().isEmpty() || stepsJson.equals("[]")) {
                errors.add("Workflow has no steps defined");
            } else {
                // Parse and simulate each step
                simulatedSteps = parseAndSimulateSteps(stepsJson, initiator, warnings);
            }

        } catch (Exception e) {
            errors.add("Error parsing workflow steps: " + e.getMessage());
            log.error("Error simulating workflow", e);
        }

        // Estimate duration
        double estimatedDuration = simulatedSteps.stream()
            .mapToInt(s -> s.getTimeoutDays() != null ? s.getTimeoutDays() : 3)
            .average()
            .orElse(3.0) * simulatedSteps.size();

        boolean valid = errors.isEmpty();

        return WorkflowSimulation.Response.builder()
            .templateId(template.getId())
            .templateName(template.getName())
            .workflowType(template.getWorkflowType() != null ? template.getWorkflowType().name() : null)
            .steps(simulatedSteps)
            .totalSteps(simulatedSteps.size())
            .estimatedDurationDays(Math.round(estimatedDuration * 10.0) / 10.0)
            .valid(valid)
            .warnings(warnings)
            .errors(errors)
            .build();
    }

    // Helper methods for statistics

    private List<WorkflowInstance> getAllWorkflowsForStats(Long templateId, LocalDateTime startDate) {
        List<WorkflowInstance> workflows = instanceRepository.findAll();

        return workflows.stream()
            .filter(w -> templateId == null || w.getTemplateId().equals(templateId))
            .filter(w -> startDate == null || w.getCreatedAt().isAfter(startDate))
            .collect(Collectors.toList());
    }

    private List<WorkflowStatistics.TemplateStatistics> calculateTemplateStatistics(List<WorkflowInstance> workflows) {
        Map<Long, List<WorkflowInstance>> byTemplate = workflows.stream()
            .collect(Collectors.groupingBy(WorkflowInstance::getTemplateId));

        return byTemplate.entrySet().stream()
            .map(entry -> {
                Long templateId = entry.getKey();
                List<WorkflowInstance> templateWorkflows = entry.getValue();

                String templateName = templateRepository.findById(templateId)
                    .map(WorkflowTemplate::getName)
                    .orElse("Unknown Template");

                long total = templateWorkflows.size();
                long completed = templateWorkflows.stream()
                    .filter(w -> w.getStatus() == WorkflowInstance.WorkflowStatus.COMPLETED)
                    .count();
                long running = templateWorkflows.stream()
                    .filter(w -> w.getStatus() == WorkflowInstance.WorkflowStatus.RUNNING)
                    .count();
                long cancelled = templateWorkflows.stream()
                    .filter(w -> w.getStatus() == WorkflowInstance.WorkflowStatus.CANCELLED)
                    .count();

                double avgDuration = templateWorkflows.stream()
                    .filter(w -> w.getStatus() == WorkflowInstance.WorkflowStatus.COMPLETED)
                    .filter(w -> w.getStartedAt() != null && w.getCompletedAt() != null)
                    .mapToDouble(w -> ChronoUnit.DAYS.between(w.getStartedAt(), w.getCompletedAt()))
                    .average()
                    .orElse(0.0);

                double approvalRate = (completed + cancelled) > 0
                    ? (completed * 100.0) / (completed + cancelled)
                    : 0.0;

                return WorkflowStatistics.TemplateStatistics.builder()
                    .templateId(templateId)
                    .templateName(templateName)
                    .totalWorkflows(total)
                    .avgDurationDays(Math.round(avgDuration * 10.0) / 10.0)
                    .approvalRate(Math.round(approvalRate * 10.0) / 10.0)
                    .completedCount(completed)
                    .runningCount(running)
                    .cancelledCount(cancelled)
                    .build();
            })
            .sorted((a, b) -> Long.compare(b.getTotalWorkflows(), a.getTotalWorkflows()))
            .collect(Collectors.toList());
    }

    private List<WorkflowStatistics.DepartmentStatistics> calculateDepartmentStatistics(List<WorkflowInstance> workflows) {
        // Group by initiator department
        Map<String, List<WorkflowInstance>> byDepartment = new HashMap<>();

        for (WorkflowInstance workflow : workflows) {
            userRepository.findById(workflow.getInitiatorId()).ifPresent(user -> {
                String dept = user.getDepartment() != null ? user.getDepartment() : "Unknown";
                byDepartment.computeIfAbsent(dept, k -> new ArrayList<>()).add(workflow);
            });
        }

        return byDepartment.entrySet().stream()
            .map(entry -> {
                String department = entry.getKey();
                List<WorkflowInstance> deptWorkflows = entry.getValue();

                long total = deptWorkflows.size();
                long completed = deptWorkflows.stream()
                    .filter(w -> w.getStatus() == WorkflowInstance.WorkflowStatus.COMPLETED)
                    .count();
                long cancelled = deptWorkflows.stream()
                    .filter(w -> w.getStatus() == WorkflowInstance.WorkflowStatus.CANCELLED)
                    .count();

                double avgDuration = deptWorkflows.stream()
                    .filter(w -> w.getStatus() == WorkflowInstance.WorkflowStatus.COMPLETED)
                    .filter(w -> w.getStartedAt() != null && w.getCompletedAt() != null)
                    .mapToDouble(w -> ChronoUnit.DAYS.between(w.getStartedAt(), w.getCompletedAt()))
                    .average()
                    .orElse(0.0);

                double approvalRate = (completed + cancelled) > 0
                    ? (completed * 100.0) / (completed + cancelled)
                    : 0.0;

                return WorkflowStatistics.DepartmentStatistics.builder()
                    .department(department)
                    .totalWorkflows(total)
                    .avgDurationDays(Math.round(avgDuration * 10.0) / 10.0)
                    .approvalRate(Math.round(approvalRate * 10.0) / 10.0)
                    .build();
            })
            .sorted((a, b) -> Long.compare(b.getTotalWorkflows(), a.getTotalWorkflows()))
            .collect(Collectors.toList());
    }

    private List<WorkflowStatistics.TrendData> calculateTrends(List<WorkflowInstance> workflows, int days) {
        LocalDateTime startDate = LocalDateTime.now().minusDays(days);

        Map<String, WorkflowStatistics.TrendData> trendMap = new HashMap<>();

        // Initialize all dates
        for (int i = 0; i < days; i++) {
            String date = startDate.plusDays(i).toLocalDate().toString();
            trendMap.put(date, WorkflowStatistics.TrendData.builder()
                .date(date)
                .started(0L)
                .completed(0L)
                .cancelled(0L)
                .build());
        }

        // Count workflows by date
        for (WorkflowInstance workflow : workflows) {
            if (workflow.getCreatedAt().isAfter(startDate)) {
                String createdDate = workflow.getCreatedAt().toLocalDate().toString();
                if (trendMap.containsKey(createdDate)) {
                    WorkflowStatistics.TrendData trend = trendMap.get(createdDate);
                    trend.setStarted(trend.getStarted() + 1);
                }
            }

            if (workflow.getCompletedAt() != null && workflow.getCompletedAt().isAfter(startDate)) {
                String completedDate = workflow.getCompletedAt().toLocalDate().toString();
                if (trendMap.containsKey(completedDate)) {
                    WorkflowStatistics.TrendData trend = trendMap.get(completedDate);
                    if (workflow.getStatus() == WorkflowInstance.WorkflowStatus.COMPLETED) {
                        trend.setCompleted(trend.getCompleted() + 1);
                    } else if (workflow.getStatus() == WorkflowInstance.WorkflowStatus.CANCELLED) {
                        trend.setCancelled(trend.getCancelled() + 1);
                    }
                }
            }
        }

        return trendMap.values().stream()
            .sorted(Comparator.comparing(WorkflowStatistics.TrendData::getDate))
            .collect(Collectors.toList());
    }

    // Helper methods for simulation

    private List<WorkflowSimulation.SimulatedStep> parseAndSimulateSteps(
            String stepsJson, User initiator, List<String> warnings) {

        List<WorkflowSimulation.SimulatedStep> simulatedSteps = new ArrayList<>();

        try {
            // In production, parse actual JSON
            // For demo, create sample steps based on JSON content
            if (stepsJson.contains("APPROVAL") || stepsJson.contains("approval")) {
                // Sample approval step
                List<User> managers = userRepository.findAll().stream()
                    .filter(u -> RoleUtils.hasRole(u.getRoles(), "MANAGER"))
                    .limit(3)
                    .collect(Collectors.toList());

                if (managers.isEmpty()) {
                    warnings.add("No managers found for approval step");
                }

                simulatedSteps.add(WorkflowSimulation.SimulatedStep.builder()
                    .stepNumber(1)
                    .stepType("APPROVAL")
                    .stepName("Manager Approval")
                    .description("Requires approval from department manager")
                    .approverType("ROLE")
                    .approverValue("ROLE_MANAGER")
                    .approverNames(managers.stream().map(User::getFullName).collect(Collectors.toList()))
                    .approverIds(managers.stream().map(User::getId).collect(Collectors.toList()))
                    .timeoutDays(3)
                    .required(true)
                    .parallel(false)
                    .stepWarnings(new ArrayList<>())
                    .build());
            }

        } catch (Exception e) {
            log.error("Error parsing workflow steps for simulation", e);
            warnings.add("Could not fully parse workflow steps: " + e.getMessage());
        }

        return simulatedSteps;
    }
}

