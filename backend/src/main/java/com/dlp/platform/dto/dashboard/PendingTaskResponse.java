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
public class PendingTaskResponse {
    private Long id;
    private String taskType;
    private String title;
    private String applicant;
    private String applicantName;
    private LocalDateTime applicationTime;
    private String urgencyLevel;
    private String status;
}
