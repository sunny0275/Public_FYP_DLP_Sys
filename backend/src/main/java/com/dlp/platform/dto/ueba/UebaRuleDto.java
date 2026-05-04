package com.dlp.platform.dto.ueba;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UebaRuleDto {
    private Long id;
    private String name;
    private String description;
    private String ruleType;
    private String conditionJson;
    private String actionOrWeight;
    private Double weight;
    private String severity;
    private String scopeJson;
    private Integer priority;
    private Boolean enabled;
    private Integer version;
    private String changedBy;
    private String changeReason;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
