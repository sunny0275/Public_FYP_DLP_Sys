package com.dlp.platform.dto.dashboard;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserSummaryResponse {
    private Long userId;
    private String accountId;
    private String fullName;
    private String email;
    private String department;
    private String position;
    private Integer pendingTaskCount;
    private Integer recentDocCount;
    private Integer alertCount;
    private Boolean passwordExpiringSoon;
    private Integer daysUntilPasswordExpiry;
}
