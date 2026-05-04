package com.dlp.platform.dto.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * DTO for DLP Policy configuration
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DlpPolicyDto {
    private Long id;
    private String policyKey;
    private String category;
    private Object policyValue;
    private Integer version;
    private Boolean active;
    private String description;
    private String changedBy;
    private String changeReason;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
