package com.dlp.platform.service.admin;

import com.dlp.platform.dto.admin.WatermarkSettingsDto;
import com.dlp.platform.entity.DlpPolicy;
import com.dlp.platform.repository.DlpPolicyRepository;
import com.dlp.platform.service.audit.AuditService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Service for managing Watermark Settings
 * Phase 04-C: Admin Settings
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class WatermarkSettingsService {

    private final DlpPolicyRepository dlpPolicyRepository;
    private final ObjectMapper objectMapper;
    private final AuditService auditService;

    private static final String WATERMARK_POLICY_KEY = "watermark.config";

    /**
     * Get watermark settings
     */
    @Transactional(readOnly = true)
    public WatermarkSettingsDto getWatermarkSettings() {
        Optional<DlpPolicy> policy = dlpPolicyRepository.findByPolicyKeyAndActiveTrue(WATERMARK_POLICY_KEY);
        
        if (policy.isPresent()) {
            try {
                return objectMapper.readValue(policy.get().getPolicyValue(), WatermarkSettingsDto.class);
            } catch (Exception e) {
                log.error("Failed to parse watermark settings", e);
            }
        }
        
        // Return default settings
        return WatermarkSettingsDto.builder()
                .style("TEXT")
                .opacity(0.5)
                .position("BOTTOM_RIGHT")
                .fontSize(12)
                .fontColor("#000000")
                .fontFamily("Arial")
                .includeTimestamp(true)
                .includeIpAddress(true)
                .includeDocumentId(true)
                .includeUsername(true)
                .content(WatermarkSettingsDto.WatermarkContent.builder()
                        .showUsername(true)
                        .showTimestamp(true)
                        .showIpAddress(true)
                        .showDocumentId(true)
                        .customTemplate("User: {username} | Time: {timestamp} | IP: {ip}")
                        .build())
                .build();
    }

    /**
     * Update watermark settings
     */
    @Transactional
    public WatermarkSettingsDto updateWatermarkSettings(
            WatermarkSettingsDto settings,
            String changedBy,
            String changeReason
    ) {
        try {
            // Deactivate current active policy
            Optional<DlpPolicy> currentActive = dlpPolicyRepository.findByPolicyKeyAndActiveTrue(WATERMARK_POLICY_KEY);
            if (currentActive.isPresent()) {
                currentActive.get().setActive(false);
                dlpPolicyRepository.save(currentActive.get());
            }

            // Create new version
            String policyValue = objectMapper.writeValueAsString(settings);
            Integer maxVersion = dlpPolicyRepository.findMaxVersionByPolicyKey(WATERMARK_POLICY_KEY);
            int newVersion = (maxVersion != null ? maxVersion : 0) + 1;

            DlpPolicy newPolicy = DlpPolicy.builder()
                    .policyKey(WATERMARK_POLICY_KEY)
                    .category("WATERMARK")
                    .policyValue(policyValue)
                    .version(newVersion)
                    .active(true)
                    .description("Watermark settings configuration")
                    .changedBy(changedBy)
                    .changeReason(changeReason)
                    .build();

            dlpPolicyRepository.save(newPolicy);

            // Log audit event
            auditService.logEvent(
                    null,
                    changedBy,
                    "UPDATE_WATERMARK_SETTINGS",
                    "ADMIN",
                    "SUCCESS",
                    "Watermark settings updated: " + changeReason,
                    null,
                    null,
                    null
            );

            return getWatermarkSettings();
        } catch (Exception e) {
            log.error("Failed to update watermark settings", e);
            throw new RuntimeException("Failed to update watermark settings: " + e.getMessage(), e);
        }
    }
}
