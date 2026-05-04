package com.dlp.platform.controller.dashboard;

import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.service.dashboard.SecurityAnalyticsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.Map;

/**
 * Team workload and SLA metrics for manager dashboard views.
 *
 * Calls SecurityAnalyticsService to compute workload and SLA breach stats from Task data.
 * Returns a single object wrapped in a List to match the frontend `any[]` expectation.
 */
@Slf4j
@RestController
@RequestMapping
@RequiredArgsConstructor
public class TeamMetricsController {

    private final SecurityAnalyticsService securityAnalyticsService;

    /**
     * GET /api/team/workload
     *
     * Returns team workload summary (totalTasks/pending/inProgress/completed/overdue).
     */
    @GetMapping("/team/workload")
    public ResponseEntity<ApiResponse<java.util.List<Map<String, Object>>>> getTeamWorkload() {
        log.debug("Team workload requested");

        Map<String, Object> workload = securityAnalyticsService.getTeamWorkloadSummary();

        return ResponseEntity.ok(
                ApiResponse.success("Team workload fetched successfully",
                        Collections.singletonList(workload))
        );
    }

    /**
     * GET /api/slas/breaches
     *
     * Returns SLA breach summary (totalBreaches + grouped by urgency level).
     */
    @GetMapping("/slas/breaches")
    public ResponseEntity<ApiResponse<java.util.List<Map<String, Object>>>> getSlaBreaches() {
        log.debug("SLA breaches requested");

        Map<String, Object> breaches = securityAnalyticsService.getSlaBreachesSummary();

        return ResponseEntity.ok(
                ApiResponse.success("SLA breaches fetched successfully",
                        Collections.singletonList(breaches))
        );
    }
}



