package com.dlp.platform.controller.workflow;

import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.dto.dashboard.PendingTaskResponse;
import com.dlp.platform.dto.workflow.TaskActionRequest;
import com.dlp.platform.dto.workflow.TaskResponse;
import com.dlp.platform.entity.User;
import com.dlp.platform.repository.UserRepository;
import com.dlp.platform.security.UserDetailsServiceImpl;
import com.dlp.platform.service.dashboard.DashboardService;
import com.dlp.platform.service.workflow.TaskService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final DashboardService dashboardService;
    private final TaskService taskService;
    private final UserRepository userRepository;

    /**
     * GET /api/tasks/pending - Get pending approval task list
     */
    @GetMapping("/pending")
    public ResponseEntity<ApiResponse<List<PendingTaskResponse>>> getPendingTasks() {
        try {
            Long userId = getCurrentUserId();
            List<PendingTaskResponse> tasks = dashboardService.getPendingTasks(userId);
            return ResponseEntity.ok(ApiResponse.success("Pending tasks fetched successfully", tasks));
        } catch (Exception e) {
            log.error("Failed to fetch pending tasks: {}", e.getMessage(), e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Failed to fetch pending tasks", e.getMessage()));
        }
    }

    /**
     * GET /api/tasks - Get all tasks for current user (paginated)
     */
    @GetMapping
    public ResponseEntity<ApiResponse<Page<TaskResponse>>> getAllTasks(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            User currentUser = getCurrentUser();
            Page<TaskResponse> tasks = taskService.getUserTasks(currentUser, page, size);
            return ResponseEntity.ok(ApiResponse.success("Tasks fetched successfully", tasks));
        } catch (Exception e) {
            log.error("Failed to fetch tasks: {}", e.getMessage(), e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Failed to fetch tasks", e.getMessage()));
        }
    }

    /**
     * GET /api/tasks/{id} - Get task details
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<TaskResponse>> getTask(@PathVariable Long id) {
        try {
            User currentUser = getCurrentUser();
            TaskResponse task = taskService.getTask(id, currentUser);
            return ResponseEntity.ok(ApiResponse.success("Task fetched successfully", task));
        } catch (Exception e) {
            log.error("Failed to fetch task {}: {}", id, e.getMessage(), e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Failed to fetch task", e.getMessage()));
        }
    }

    /**
     * POST /api/tasks/{id}/action - Process task action (approve/reject/delegate)
     */
    @PostMapping("/{id}/action")
    public ResponseEntity<ApiResponse<TaskResponse>> processTaskAction(
            @PathVariable Long id,
            @Valid @RequestBody TaskActionRequest request,
            HttpServletRequest httpRequest) {
        try {
            User currentUser = getCurrentUser();
            String ipAddress = getClientIpAddress(httpRequest);
            TaskResponse task = taskService.processTaskAction(id, request, currentUser, ipAddress);
            return ResponseEntity.ok(ApiResponse.success("Task action processed successfully", task));
        } catch (Exception e) {
            log.error("Failed to process task action for task {}: {}", id, e.getMessage(), e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Failed to process task action", e.getMessage()));
        }
    }

    /**
     * GET /api/tasks/overdue - Get overdue tasks
     */
    @GetMapping("/overdue")
    public ResponseEntity<ApiResponse<List<TaskResponse>>> getOverdueTasks() {
        try {
            List<TaskResponse> tasks = taskService.getOverdueTasks();
            return ResponseEntity.ok(ApiResponse.success("Overdue tasks fetched successfully", tasks));
        } catch (Exception e) {
            log.error("Failed to fetch overdue tasks: {}", e.getMessage(), e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Failed to fetch overdue tasks", e.getMessage()));
        }
    }

    /**
     * GET /api/tasks/count - Get pending task count for current user
     */
    @GetMapping("/count")
    public ResponseEntity<ApiResponse<Long>> getTaskCount() {
        try {
            User currentUser = getCurrentUser();
            long count = taskService.countUserPendingTasks(currentUser);
            return ResponseEntity.ok(ApiResponse.success("Task count fetched successfully", count));
        } catch (Exception e) {
            log.error("Failed to fetch task count: {}", e.getMessage(), e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Failed to fetch task count", e.getMessage()));
        }
    }

    /**
     * Helper method to get current user ID from security context
     */
    private Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication != null && authentication.getPrincipal() instanceof UserDetailsServiceImpl.CustomUserDetails) {
            UserDetailsServiceImpl.CustomUserDetails userDetails =
                    (UserDetailsServiceImpl.CustomUserDetails) authentication.getPrincipal();
            return userDetails.getUserId();
        }

        throw new IllegalStateException("User not authenticated");
    }

    /**
     * Helper method to get current user entity
     */
    private User getCurrentUser() {
        Long userId = getCurrentUserId();
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalStateException("User not found"));
    }

    /**
     * Helper method to get client IP address
     */
    private String getClientIpAddress(HttpServletRequest request) {
        String xForwardedForHeader = request.getHeader("X-Forwarded-For");
        if (xForwardedForHeader != null && !xForwardedForHeader.isEmpty()) {
            return xForwardedForHeader.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
