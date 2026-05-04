package com.dlp.platform.dto.workflow;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * DTO container for workflow simulation request and response.
 * Outer class is just a namespace; only inner classes are instantiated.
 */
public class WorkflowSimulation {

    /**
     * Request DTO
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Request {
        private Long templateId;
        private Long userId;
        private Long documentId;
        private String classificationLevel;
    }

    /**
     * Response DTO
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Response {
        private Long templateId;
        private String templateName;
        private String workflowType;

        private List<SimulatedStep> steps;
        private Integer totalSteps;
        private Double estimatedDurationDays;

        private Boolean valid;
        private List<String> warnings;
        private List<String> errors;
    }

    /**
     * Simulated workflow step
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SimulatedStep {
        private Integer stepNumber;
        private String stepType;
        private String stepName;
        private String description;

        // Approver information
        private String approverType;    // ROLE, DEPARTMENT, SPECIFIC_USER, MIXED
        private String approverValue;   // The rule value (e.g., "ROLE_MANAGER")
        private List<String> approverNames;  // Resolved approver names
        private List<Long> approverIds;      // Resolved approver user IDs

        private Integer timeoutDays;
        private Boolean required;
        private Boolean parallel;       // True if this step runs in parallel with next

        // Warnings for this step
        private List<String> stepWarnings;
    }
}
