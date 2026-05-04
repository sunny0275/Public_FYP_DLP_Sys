package com.dlp.platform.dto.audit;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class AuditLogSearchCriteria {

    private Long userId;
    private String userName;
    private String accountId;
    private String searchTerm;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String severity;
    
    // Additional filters for Phase 04-A
    private Long documentId;  // Filter by document ID (extracted from details)
    private String action;    // Filter by action type (e.g., "VIEW_DOCUMENT", "DOWNLOAD_DOCUMENT")
    private String category;  // Filter by category (AUTH, DOCUMENT, ADMIN, SYSTEM)
    private String result;    // Filter by result (SUCCESS, FAILURE, WARNING)
}


































