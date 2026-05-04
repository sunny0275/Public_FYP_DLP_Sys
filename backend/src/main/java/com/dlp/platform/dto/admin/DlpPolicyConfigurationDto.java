package com.dlp.platform.dto.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * DTO for complete DLP policy configuration (all categories)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DlpPolicyConfigurationDto {
    private ClassificationPolicy classification;
    private AccessControlPolicy accessControl;
    private SharingPolicy sharing;
    private EdrPolicy edr;
    private AnomalyDetectionPolicy anomalyDetection;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ClassificationPolicy {
        private Double confidenceThreshold;
        private Map<String, Map<String, Boolean>> levelAccessMapping;
        private Map<String, String> levelWorkflowMapping;
        private Boolean autoReviewEnabled;
        private Double autoReviewThreshold;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AccessControlPolicy {
        private Map<String, List<String>> roleDocumentAccess;
        private Map<String, List<String>> departmentAccess;
        private Map<String, Map<String, Boolean>> tagPolicies;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SharingPolicy {
        private Map<String, Boolean> externalSharingAllowed;
        private Integer batchExportLimit;
        private Map<String, Boolean> externalSharingRequiresApproval;
        private Map<String, Boolean> watermarkEnforcement;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EdrPolicy {
        private Map<String, List<String>> triggerConditions;
        private Map<String, String> responseActions;
        private Double anomalySensitivity;
        private Map<String, Boolean> devicePostureRequirements;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AnomalyDetectionPolicy {
        private Map<String, Boolean> keyRevocationTriggers;
        private Map<String, Double> riskScoringRules;
        private Map<String, Double> alertThresholds;
    }
}
