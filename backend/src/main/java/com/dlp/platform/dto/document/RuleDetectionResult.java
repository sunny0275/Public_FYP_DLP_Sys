package com.dlp.platform.dto.document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Result of rule-based PII detection (plus non-PII markers used for tagging, e.g. finance keywords)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RuleDetectionResult {

    @Builder.Default
    private List<Detection> detections = new ArrayList<>();

    public boolean hasDetections() {
        return !detections.isEmpty();
    }

    public boolean hasHighRiskDetections() {
        return detections.stream().anyMatch(Detection::isHighRisk);
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Detection {
        private String type; // e.g., "SSN", "CREDIT_CARD", "EMAIL", "PHONE"
        private int count;
        private boolean highRisk; // SSN, credit card = high risk
    }
}
