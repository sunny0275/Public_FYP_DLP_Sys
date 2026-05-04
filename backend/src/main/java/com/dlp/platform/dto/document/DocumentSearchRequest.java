package com.dlp.platform.dto.document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentSearchRequest {

    private String query;
    private String department;
    private String classificationLevel;
    private String status;
    private String[] tags;
    private LocalDateTime startDate;  // For date range filter
    private LocalDateTime endDate;    // For date range filter
    private String sortBy;
    private String sortOrder;
    private Integer page;
    private Integer pageSize;
}
