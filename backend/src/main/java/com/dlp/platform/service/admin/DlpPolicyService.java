package com.dlp.platform.service.admin;

import com.dlp.platform.dto.admin.DlpPolicyConfigurationDto;
import com.dlp.platform.dto.admin.DlpPolicyDto;
import com.dlp.platform.entity.DlpPolicy;
import com.dlp.platform.service.audit.AuditService;
import com.dlp.platform.repository.DlpPolicyRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for managing DLP policies with version control
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class DlpPolicyService {

    private final DlpPolicyRepository dlpPolicyRepository;
    private final ObjectMapper objectMapper;
    private final AuditService auditService;

    /**
     * Get complete DLP policy configuration
     */
    @Transactional(readOnly = true)
    public DlpPolicyConfigurationDto getDlpPolicyConfiguration() {
        List<DlpPolicy> activePolicies = dlpPolicyRepository.findByActiveTrue();
        
        DlpPolicyConfigurationDto.DlpPolicyConfigurationDtoBuilder builder = DlpPolicyConfigurationDto.builder();
        
        // Group policies by category
        Map<String, List<DlpPolicy>> policiesByCategory = activePolicies.stream()
                .collect(Collectors.groupingBy(DlpPolicy::getCategory));
        
        // Build configuration from active policies
        builder.classification(buildClassificationPolicy(policiesByCategory.getOrDefault("CLASSIFICATION", Collections.emptyList())))
                .accessControl(buildAccessControlPolicy(policiesByCategory.getOrDefault("ACCESS_CONTROL", Collections.emptyList())))
                .sharing(buildSharingPolicy(policiesByCategory.getOrDefault("SHARING", Collections.emptyList())))
                .edr(buildEdrPolicy(policiesByCategory.getOrDefault("EDR", Collections.emptyList())))
                .anomalyDetection(buildAnomalyDetectionPolicy(policiesByCategory.getOrDefault("ANOMALY_DETECTION", Collections.emptyList())));
        
        return builder.build();
    }

    /**
     * Update DLP policy configuration
     * Creates new version and deactivates old version
     */
    @Transactional
    public DlpPolicyConfigurationDto updateDlpPolicyConfiguration(
            DlpPolicyConfigurationDto configuration,
            String changedBy,
            String changeReason
    ) {
        // Deactivate all current active policies
        List<DlpPolicy> activePolicies = dlpPolicyRepository.findByActiveTrue();
        for (DlpPolicy policy : activePolicies) {
            policy.setActive(false);
            dlpPolicyRepository.save(policy);
        }

        // Create new versions
        if (configuration.getClassification() != null) {
            savePolicyCategory("CLASSIFICATION", configuration.getClassification(), changedBy, changeReason);
        }
        if (configuration.getAccessControl() != null) {
            savePolicyCategory("ACCESS_CONTROL", configuration.getAccessControl(), changedBy, changeReason);
        }
        if (configuration.getSharing() != null) {
            savePolicyCategory("SHARING", configuration.getSharing(), changedBy, changeReason);
        }
        if (configuration.getEdr() != null) {
            savePolicyCategory("EDR", configuration.getEdr(), changedBy, changeReason);
        }
        if (configuration.getAnomalyDetection() != null) {
            savePolicyCategory("ANOMALY_DETECTION", configuration.getAnomalyDetection(), changedBy, changeReason);
        }

        // Log audit event
        auditService.logEvent(
                null, // userId will be set by audit service if available
                changedBy,
                "UPDATE_DLP_POLICY",
                "ADMIN",
                "SUCCESS",
                "DLP policy configuration updated: " + changeReason,
                null,
                null,
                null
        );

        return getDlpPolicyConfiguration();
    }

    /**
     * Get policy change history
     */
    @Transactional(readOnly = true)
    public List<DlpPolicyDto> getPolicyHistory(String policyKey) {
        List<DlpPolicy> policies = dlpPolicyRepository.findByPolicyKeyOrderByVersionDesc(policyKey);
        return policies.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    /**
     * Rollback to a specific policy version
     */
    @Transactional
    public DlpPolicyConfigurationDto rollbackPolicy(String policyKey, Integer version, String changedBy, String changeReason) {
        Optional<DlpPolicy> targetPolicy = dlpPolicyRepository.findByPolicyKeyAndVersion(policyKey, version);
        if (targetPolicy.isEmpty()) {
            throw new IllegalArgumentException("Policy version not found: " + policyKey + " v" + version);
        }

        // Deactivate current active policy
        Optional<DlpPolicy> currentActive = dlpPolicyRepository.findByPolicyKeyAndActiveTrue(policyKey);
        if (currentActive.isPresent()) {
            currentActive.get().setActive(false);
            dlpPolicyRepository.save(currentActive.get());
        }

        // Create new version from target version
        DlpPolicy target = targetPolicy.get();
        Integer maxVersion = dlpPolicyRepository.findMaxVersionByPolicyKey(policyKey);
        DlpPolicy newVersion = DlpPolicy.builder()
                .policyKey(target.getPolicyKey())
                .category(target.getCategory())
                .policyValue(target.getPolicyValue())
                .version(maxVersion + 1)
                .active(true)
                .description("Rollback to version " + version + ": " + changeReason)
                .changedBy(changedBy)
                .changeReason(changeReason)
                .build();
        
        dlpPolicyRepository.save(newVersion);

        // Log audit event
        auditService.logEvent(
                null,
                changedBy,
                "ROLLBACK_DLP_POLICY",
                "ADMIN",
                "SUCCESS",
                "DLP policy rolled back: " + policyKey + " to version " + version,
                null,
                null,
                null
        );

        return getDlpPolicyConfiguration();
    }

    private void savePolicyCategory(String category, Object policyData, String changedBy, String changeReason) {
        try {
            String policyValue = objectMapper.writeValueAsString(policyData);
            String policyKey = category.toLowerCase() + ".config";
            
            Integer maxVersion = dlpPolicyRepository.findMaxVersionByPolicyKey(policyKey);
            int newVersion = (maxVersion != null ? maxVersion : 0) + 1;
            
            DlpPolicy policy = DlpPolicy.builder()
                    .policyKey(policyKey)
                    .category(category)
                    .policyValue(policyValue)
                    .version(newVersion)
                    .active(true)
                    .description("Policy configuration for " + category)
                    .changedBy(changedBy)
                    .changeReason(changeReason)
                    .build();
            
            dlpPolicyRepository.save(policy);
        } catch (Exception e) {
            log.error("Failed to save policy category: " + category, e);
            throw new RuntimeException("Failed to save policy: " + e.getMessage(), e);
        }
    }

    private DlpPolicyConfigurationDto.ClassificationPolicy buildClassificationPolicy(List<DlpPolicy> policies) {
        // Default values if no policies exist
        DlpPolicyConfigurationDto.ClassificationPolicy.ClassificationPolicyBuilder builder = 
                DlpPolicyConfigurationDto.ClassificationPolicy.builder()
                        .confidenceThreshold(0.7)
                        .autoReviewEnabled(true)
                        .autoReviewThreshold(0.6);
        
        // Load from policies if available
        for (DlpPolicy policy : policies) {
            try {
                Map<String, Object> value = objectMapper.readValue(policy.getPolicyValue(), 
                        new TypeReference<Map<String, Object>>() {});
                // Map values to ClassificationPolicy fields
                if (value.containsKey("confidenceThreshold")) {
                    builder.confidenceThreshold(((Number) value.get("confidenceThreshold")).doubleValue());
                }
                if (value.containsKey("autoReviewEnabled")) {
                    builder.autoReviewEnabled((Boolean) value.get("autoReviewEnabled"));
                }
                if (value.containsKey("autoReviewThreshold")) {
                    builder.autoReviewThreshold(((Number) value.get("autoReviewThreshold")).doubleValue());
                }
                if (value.containsKey("levelAccessMapping")) {
                    builder.levelAccessMapping((Map<String, Map<String, Boolean>>) value.get("levelAccessMapping"));
                }
                if (value.containsKey("levelWorkflowMapping")) {
                    builder.levelWorkflowMapping((Map<String, String>) value.get("levelWorkflowMapping"));
                }
            } catch (Exception e) {
                log.warn("Failed to parse classification policy: " + policy.getPolicyKey(), e);
            }
        }
        
        return builder.build();
    }

    private DlpPolicyConfigurationDto.AccessControlPolicy buildAccessControlPolicy(List<DlpPolicy> policies) {
        DlpPolicyConfigurationDto.AccessControlPolicy.AccessControlPolicyBuilder builder = 
                DlpPolicyConfigurationDto.AccessControlPolicy.builder();
        
        for (DlpPolicy policy : policies) {
            try {
                Map<String, Object> value = objectMapper.readValue(policy.getPolicyValue(), 
                        new TypeReference<Map<String, Object>>() {});
                if (value.containsKey("roleDocumentAccess")) {
                    builder.roleDocumentAccess((Map<String, List<String>>) value.get("roleDocumentAccess"));
                }
                if (value.containsKey("departmentAccess")) {
                    builder.departmentAccess((Map<String, List<String>>) value.get("departmentAccess"));
                }
                if (value.containsKey("tagPolicies")) {
                    builder.tagPolicies((Map<String, Map<String, Boolean>>) value.get("tagPolicies"));
                }
            } catch (Exception e) {
                log.warn("Failed to parse access control policy: " + policy.getPolicyKey(), e);
            }
        }
        
        return builder.build();
    }

    private DlpPolicyConfigurationDto.SharingPolicy buildSharingPolicy(List<DlpPolicy> policies) {
        DlpPolicyConfigurationDto.SharingPolicy.SharingPolicyBuilder builder = 
                DlpPolicyConfigurationDto.SharingPolicy.builder()
                        .batchExportLimit(10);
        
        for (DlpPolicy policy : policies) {
            try {
                Map<String, Object> value = objectMapper.readValue(policy.getPolicyValue(), 
                        new TypeReference<Map<String, Object>>() {});
                if (value.containsKey("externalSharingAllowed")) {
                    builder.externalSharingAllowed((Map<String, Boolean>) value.get("externalSharingAllowed"));
                }
                if (value.containsKey("batchExportLimit")) {
                    builder.batchExportLimit(((Number) value.get("batchExportLimit")).intValue());
                }
                if (value.containsKey("externalSharingRequiresApproval")) {
                    builder.externalSharingRequiresApproval((Map<String, Boolean>) value.get("externalSharingRequiresApproval"));
                }
                if (value.containsKey("watermarkEnforcement")) {
                    builder.watermarkEnforcement((Map<String, Boolean>) value.get("watermarkEnforcement"));
                }
            } catch (Exception e) {
                log.warn("Failed to parse sharing policy: " + policy.getPolicyKey(), e);
            }
        }
        
        return builder.build();
    }

    private DlpPolicyConfigurationDto.EdrPolicy buildEdrPolicy(List<DlpPolicy> policies) {
        DlpPolicyConfigurationDto.EdrPolicy.EdrPolicyBuilder builder = 
                DlpPolicyConfigurationDto.EdrPolicy.builder()
                        .anomalySensitivity(0.5);
        
        for (DlpPolicy policy : policies) {
            try {
                Map<String, Object> value = objectMapper.readValue(policy.getPolicyValue(), 
                        new TypeReference<Map<String, Object>>() {});
                if (value.containsKey("triggerConditions")) {
                    builder.triggerConditions((Map<String, List<String>>) value.get("triggerConditions"));
                }
                if (value.containsKey("responseActions")) {
                    builder.responseActions((Map<String, String>) value.get("responseActions"));
                }
                if (value.containsKey("anomalySensitivity")) {
                    builder.anomalySensitivity(((Number) value.get("anomalySensitivity")).doubleValue());
                }
                if (value.containsKey("devicePostureRequirements")) {
                    builder.devicePostureRequirements((Map<String, Boolean>) value.get("devicePostureRequirements"));
                }
            } catch (Exception e) {
                log.warn("Failed to parse EDR policy: " + policy.getPolicyKey(), e);
            }
        }
        
        return builder.build();
    }

    private DlpPolicyConfigurationDto.AnomalyDetectionPolicy buildAnomalyDetectionPolicy(List<DlpPolicy> policies) {
        DlpPolicyConfigurationDto.AnomalyDetectionPolicy.AnomalyDetectionPolicyBuilder builder = 
                DlpPolicyConfigurationDto.AnomalyDetectionPolicy.builder();
        
        for (DlpPolicy policy : policies) {
            try {
                Map<String, Object> value = objectMapper.readValue(policy.getPolicyValue(), 
                        new TypeReference<Map<String, Object>>() {});
                if (value.containsKey("keyRevocationTriggers")) {
                    builder.keyRevocationTriggers((Map<String, Boolean>) value.get("keyRevocationTriggers"));
                }
                if (value.containsKey("riskScoringRules")) {
                    builder.riskScoringRules((Map<String, Double>) value.get("riskScoringRules"));
                }
                if (value.containsKey("alertThresholds")) {
                    builder.alertThresholds((Map<String, Double>) value.get("alertThresholds"));
                }
            } catch (Exception e) {
                log.warn("Failed to parse anomaly detection policy: " + policy.getPolicyKey(), e);
            }
        }
        
        return builder.build();
    }

    private DlpPolicyDto toDto(DlpPolicy policy) {
        try {
            Object policyValue = objectMapper.readValue(policy.getPolicyValue(), Object.class);
            return DlpPolicyDto.builder()
                    .id(policy.getId())
                    .policyKey(policy.getPolicyKey())
                    .category(policy.getCategory())
                    .policyValue(policyValue)
                    .version(policy.getVersion())
                    .active(policy.getActive())
                    .description(policy.getDescription())
                    .changedBy(policy.getChangedBy())
                    .changeReason(policy.getChangeReason())
                    .createdAt(policy.getCreatedAt())
                    .updatedAt(policy.getUpdatedAt())
                    .build();
        } catch (Exception e) {
            log.error("Failed to convert policy to DTO: " + policy.getPolicyKey(), e);
            return DlpPolicyDto.builder()
                    .id(policy.getId())
                    .policyKey(policy.getPolicyKey())
                    .category(policy.getCategory())
                    .version(policy.getVersion())
                    .active(policy.getActive())
                    .build();
        }
    }
}
