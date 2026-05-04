package com.dlp.platform.dto.document;

import com.dlp.platform.entity.Document;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Document metadata for classification
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentMetadata {
    private String fileName;
    private String department;
    private String ownerName;
    private Long fileSize;
    private Document.ClassificationLevel selectedClassificationLevel;
    private String userDescription;
    private String templateType;
    private String templateDataJson;
}
