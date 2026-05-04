package com.dlp.platform.controller.workflow;

import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.dto.workflow.*;
import com.dlp.platform.entity.User;
import com.dlp.platform.service.workflow.WorkflowService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST Controller for workflow management
 *
 * Endpoints:
 * - POST /api/workflows/templates - Create workflow template
 * - GET /api/workflows/templates - Get published templates
 * - POST /api/workflows/templates/{id}/publish - Publish template
 * - POST /api/workflows/instances - Start workflow
 * - GET /api/workflows/instances/{id} - Get workflow details
 * - GET /api/workflows/my - Get user's workflows
 * - DELETE /api/workflows/instances/{id} - Cancel workflow
 */
@RestController
@RequestMapping("/workflows")
@Slf4j
@RequiredArgsConstructor
public class WorkflowController {

    private final WorkflowService workflowService;

    /**
     * Create a new workflow template
     * POST /api/workflows/templates
     */
    @PostMapping("/templates")
    public ResponseEntity<ApiResponse<WorkflowTemplateResponse>> createTemplate(
            @Valid @RequestBody WorkflowTemplateRequest request,
            @AuthenticationPrincipal User currentUser) {

        try {
            WorkflowTemplateResponse response = workflowService.createTemplate(request, currentUser);
            return ResponseEntity.ok(ApiResponse.success("Workflow template created", response));

        } catch (org.springframework.security.access.AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                .body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("Error creating workflow template", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to create workflow template"));
        }
    }

    /**
     * Get all published workflow templates
     * GET /api/workflows/templates
     */
    @GetMapping("/templates")
    public ResponseEntity<ApiResponse<List<WorkflowTemplateResponse>>> getPublishedTemplates() {

        try {
            List<WorkflowTemplateResponse> templates = workflowService.getPublishedTemplates();
            return ResponseEntity.ok(ApiResponse.success("Templates retrieved", templates));

        } catch (Exception e) {
            log.error("Error retrieving workflow templates", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to retrieve templates"));
        }
    }

    /**
     * Get all workflow templates (including drafts) - Admin only
     * GET /api/workflows/templates/all
     */
    @GetMapping("/templates/all")
    public ResponseEntity<ApiResponse<List<WorkflowTemplateResponse>>> getAllTemplates(
            @AuthenticationPrincipal User currentUser) {

        try {
            List<WorkflowTemplateResponse> templates = workflowService.getAllTemplates(currentUser);
            return ResponseEntity.ok(ApiResponse.success("All templates retrieved", templates));

        } catch (org.springframework.security.access.AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("Error retrieving all workflow templates", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to retrieve templates"));
        }
    }

    /**
     * Get workflow template by ID
     * GET /api/workflows/templates/{id}
     */
    @GetMapping("/templates/{id}")
    public ResponseEntity<ApiResponse<WorkflowTemplateResponse>> getTemplate(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser) {

        try {
            WorkflowTemplateResponse response = workflowService.getTemplateById(id, currentUser);
            return ResponseEntity.ok(ApiResponse.success("Template retrieved", response));

        } catch (org.springframework.security.access.AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(e.getMessage()));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("Template not found"));
        } catch (Exception e) {
            log.error("Error retrieving workflow template", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to retrieve template"));
        }
    }

    /**
     * Update workflow template (draft only)
     * PUT /api/workflows/templates/{id}
     */
    @PutMapping("/templates/{id}")
    public ResponseEntity<ApiResponse<WorkflowTemplateResponse>> updateTemplate(
            @PathVariable Long id,
            @Valid @RequestBody WorkflowTemplateRequest request,
            @AuthenticationPrincipal User currentUser) {

        try {
            WorkflowTemplateResponse response = workflowService.updateTemplate(id, request, currentUser);
            return ResponseEntity.ok(ApiResponse.success("Template updated successfully", response));

        } catch (org.springframework.security.access.AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest()
                .body(ApiResponse.error(e.getMessage()));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("Template not found"));
        } catch (Exception e) {
            log.error("Error updating workflow template", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to update template"));
        }
    }

    /**
     * Delete workflow template (draft only)
     * DELETE /api/workflows/templates/{id}
     */
    @DeleteMapping("/templates/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteTemplate(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser) {

        try {
            workflowService.deleteTemplate(id, currentUser);
            return ResponseEntity.ok(ApiResponse.success("Template deleted successfully", null));

        } catch (org.springframework.security.access.AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest()
                .body(ApiResponse.error(e.getMessage()));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("Template not found"));
        } catch (Exception e) {
            log.error("Error deleting workflow template", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to delete template"));
        }
    }

    /**
     * Archive workflow template
     * POST /api/workflows/templates/{id}/archive
     */
    @PostMapping("/templates/{id}/archive")
    public ResponseEntity<ApiResponse<WorkflowTemplateResponse>> archiveTemplate(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser) {

        try {
            WorkflowTemplateResponse response = workflowService.archiveTemplate(id, currentUser);
            return ResponseEntity.ok(ApiResponse.success("Template archived successfully", response));

        } catch (org.springframework.security.access.AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(e.getMessage()));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("Template not found"));
        } catch (Exception e) {
            log.error("Error archiving workflow template", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to archive template"));
        }
    }

    /**
     * Get workflow template version diff
     * GET /api/workflows/templates/{id}/diff?fromVersion=&toVersion=
     */
    @GetMapping("/templates/{id}/diff")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getTemplateDiff(
            @PathVariable Long id,
            @RequestParam(required = false) Integer fromVersion,
            @RequestParam(required = false) Integer toVersion,
            @AuthenticationPrincipal User currentUser) {

        try {
            Map<String, Object> diff = workflowService.getTemplateDiff(id, fromVersion, toVersion, currentUser);
            return ResponseEntity.ok(ApiResponse.success("Template diff", diff));
        } catch (org.springframework.security.access.AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error(e.getMessage()));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error("Template not found"));
        } catch (Exception e) {
            log.error("Error getting template diff", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ApiResponse.error("Failed to get diff"));
        }
    }

    /**
     * Validate workflow template structure
     * POST /api/workflows/templates/validate
     */
    @PostMapping("/templates/validate")
    public ResponseEntity<ApiResponse<Map<String, Object>>> validateTemplate(
            @Valid @RequestBody WorkflowTemplateRequest request,
            @AuthenticationPrincipal User currentUser) {

        try {
            Map<String, Object> validationResult = workflowService.validateTemplate(request, currentUser);
            return ResponseEntity.ok(ApiResponse.success("Template validation completed", validationResult));

        } catch (Exception e) {
            log.error("Error validating workflow template", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to validate template"));
        }
    }

    /**
     * Publish a workflow template
     * POST /api/workflows/templates/{id}/publish
     */
    @PostMapping("/templates/{id}/publish")
    public ResponseEntity<ApiResponse<WorkflowTemplateResponse>> publishTemplate(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser) {

        try {
            WorkflowTemplateResponse response = workflowService.publishTemplate(id, currentUser);
            return ResponseEntity.ok(ApiResponse.success("Template published successfully", response));

        } catch (org.springframework.security.access.AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(e.getMessage()));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("Template not found"));
        } catch (Exception e) {
            log.error("Error publishing workflow template", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to publish template"));
        }
    }

    /**
     * Start a new workflow instance
     * POST /api/workflows/instances
     */
    @PostMapping("/instances")
    public ResponseEntity<ApiResponse<WorkflowInstanceResponse>> startWorkflow(
            @Valid @RequestBody WorkflowInstanceRequest request,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest httpRequest) {

        try {
            String ipAddress = httpRequest.getRemoteAddr();
            WorkflowInstanceResponse response = workflowService.startWorkflow(request, currentUser, ipAddress);

            return ResponseEntity.ok(ApiResponse.success("Workflow started successfully", response));

        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest()
                .body(ApiResponse.error(e.getMessage()));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("Workflow template not found"));
        } catch (Exception e) {
            log.error("Error starting workflow", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to start workflow"));
        }
    }

    /**
     * Get workflow instance details
     * GET /api/workflows/instances/{id}
     */
    @GetMapping("/instances/{id}")
    public ResponseEntity<ApiResponse<WorkflowInstanceResponse>> getWorkflowInstance(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser) {

        try {
            WorkflowInstanceResponse response = workflowService.getWorkflowInstance(id, currentUser);
            return ResponseEntity.ok(ApiResponse.success("Workflow retrieved", response));

        } catch (org.springframework.security.access.AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(e.getMessage()));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("Workflow not found"));
        } catch (Exception e) {
            log.error("Error retrieving workflow instance", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to retrieve workflow"));
        }
    }

    /**
     * Get user's workflow instances
     * GET /api/workflows/my
     */
    @GetMapping("/my")
    public ResponseEntity<ApiResponse<Page<WorkflowInstanceResponse>>> getUserWorkflows(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal User currentUser) {

        try {
            Page<WorkflowInstanceResponse> workflows = workflowService.getUserWorkflows(currentUser, page, size);
            return ResponseEntity.ok(ApiResponse.success("Workflows retrieved", workflows));

        } catch (Exception e) {
            log.error("Error retrieving user workflows", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to retrieve workflows"));
        }
    }

    /**
     * Cancel a workflow instance
     * DELETE /api/workflows/instances/{id}
     */
    @DeleteMapping("/instances/{id}")
    public ResponseEntity<ApiResponse<Void>> cancelWorkflow(
            @PathVariable Long id,
            @RequestParam(required = false) String reason,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest httpRequest) {

        try {
            String ipAddress = httpRequest.getRemoteAddr();
            workflowService.cancelWorkflow(id, currentUser, reason, ipAddress);

            return ResponseEntity.ok(ApiResponse.success("Workflow cancelled successfully", null));

        } catch (org.springframework.security.access.AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest()
                .body(ApiResponse.error(e.getMessage()));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("Workflow not found"));
        } catch (Exception e) {
            log.error("Error cancelling workflow", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to cancel workflow"));
        }
    }

    /**
     * Get workflow statistics
     * GET /api/workflows/statistics
     */
    @GetMapping("/statistics")
    public ResponseEntity<ApiResponse<WorkflowStatistics>> getStatistics(
            @RequestParam(required = false) Long templateId,
            @RequestParam(required = false) Integer days) {

        try {
            WorkflowStatistics stats = workflowService.getWorkflowStatistics(templateId, days);
            return ResponseEntity.ok(ApiResponse.success("Statistics retrieved", stats));

        } catch (Exception e) {
            log.error("Error retrieving workflow statistics", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to retrieve statistics"));
        }
    }

    /**
     * Simulate workflow execution
     * POST /api/workflows/simulate
     */
    @PostMapping("/simulate")
    public ResponseEntity<ApiResponse<WorkflowSimulation.Response>> simulateWorkflow(
            @Valid @RequestBody WorkflowSimulation.Request request) {

        try {
            WorkflowSimulation.Response simulation = workflowService.simulateWorkflow(request);
            return ResponseEntity.ok(ApiResponse.success("Workflow simulated", simulation));

        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("Error simulating workflow", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to simulate workflow"));
        }
    }
}
