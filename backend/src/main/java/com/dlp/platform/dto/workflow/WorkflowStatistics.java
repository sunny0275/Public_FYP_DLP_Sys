package com.dlp.platform.dto.workflow;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * DTO for workflow statistics and analytics
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowStatistics {

    /**
     * Overall statistics
     */
    private Long totalWorkflows;
    private Long completedWorkflows;
    private Long runningWorkflows;
    private Long cancelledWorkflows;

    private Double averageDurationDays;
    private Double approvalRate;        // Percentage of approved workflows
    private Double timeoutRate;         // Percentage of workflows that timed out
    private Double completionRate;      // Percentage of completed workflows

    /**
     * Time period for statistics
     */
    private String period;  // e.g., "Last 30 days", "All time"

    /**
     * Statistics by template
     */
    private List<TemplateStatistics> byTemplate;

    /**
     * Statistics by department
     */
    private List<DepartmentStatistics> byDepartment;

    /**
     * Recent workflow trends
     */
    private List<TrendData> trends;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TemplateStatistics {
        private Long templateId;
        private String templateName;
        private Long totalWorkflows;
        private Double avgDurationDays;
        private Double approvalRate;
        private Long completedCount;
        private Long runningCount;
        private Long cancelledCount;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DepartmentStatistics {
        private String department;
        private Long totalWorkflows;
        private Double avgDurationDays;
        private Double approvalRate;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TrendData {
        private String date;        // YYYY-MM-DD
        private Long started;       // Workflows started on this date
        private Long completed;     // Workflows completed on this date
        private Long cancelled;     // Workflows cancelled on this date
    }
}
