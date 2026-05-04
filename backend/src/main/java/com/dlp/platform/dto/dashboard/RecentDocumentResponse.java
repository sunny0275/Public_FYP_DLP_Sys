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
public class RecentDocumentResponse {
    private Long id;
    private String documentName;
    private String department;
    private String classificationLevel;
    private LocalDateTime lastAccessTime;
    private String fileType;
    private Long fileSize;
}
