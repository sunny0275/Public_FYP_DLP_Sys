package com.dlp.platform.controller.dashboard;

import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.dto.dashboard.*;
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
@RequestMapping("/me")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    /**
     * GET /api/me/summary - Get user summary information
     */
    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<UserSummaryResponse>> getUserSummary() {
        try {
            Long userId = getCurrentUserId();
            UserSummaryResponse summary = dashboardService.getUserSummary(userId);
            return ResponseEntity.ok(ApiResponse.success("User summary fetched successfully", summary));
        } catch (Exception e) {
            log.error("Failed to fetch user summary: {}", e.getMessage(), e);
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Failed to fetch user summary", e.getMessage()));
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
