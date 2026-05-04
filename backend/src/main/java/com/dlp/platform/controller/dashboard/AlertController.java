package com.dlp.platform.controller.dashboard;

import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.dto.dashboard.AlertResponse;
import com.dlp.platform.security.UserDetailsServiceImpl;
import com.dlp.platform.service.dashboard.DashboardService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/alerts")
@RequiredArgsConstructor
public class AlertController {

    private final DashboardService dashboardService;

    /**
     * GET /api/alerts/recent - Get recent alert information
     */
    @GetMapping("/recent")
    public ResponseEntity<ApiResponse<List<AlertResponse>>> getRecentAlerts() {
        try {
            Long userId = getCurrentUserId();
            List<AlertResponse> alerts = dashboardService.getRecentAlerts(userId);
            return ResponseEntity.ok(ApiResponse.success("Recent alerts fetched successfully", alerts));
        } catch (Exception e) {
            log.error("Failed to fetch recent alerts: {}", e.getMessage(), e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Failed to fetch recent alerts", e.getMessage()));
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
}
