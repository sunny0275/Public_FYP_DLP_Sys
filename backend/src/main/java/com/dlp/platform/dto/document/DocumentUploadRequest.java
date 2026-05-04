package com.dlp.platform.dto.document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Set;

/**
 * DTO for document upload / metadata update.
 * Uses Lombok builder for convenient construction from controllers.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentUploadRequest {

    private String name;
    private String department;
    private String classificationLevel;
    private Set<String> tags;
    private String description;
    private String templateType;
    private String templateDataJson;

    /**
     * Unified expiration field used by services and entities.
     * (Named expirationDate to match Document.expirationDate)
     */
    private LocalDateTime expirationDate;
}
