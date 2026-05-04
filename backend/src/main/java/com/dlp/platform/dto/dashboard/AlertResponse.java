package com.dlp.platform.dto.dashboard;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertResponse {
    private Long id;
    private String alertType;
    private String severity;
    private LocalDateTime alertTime;
    private String description;
    private String resourceType;
    private String resourceId;
    private Boolean acknowledged;
}
