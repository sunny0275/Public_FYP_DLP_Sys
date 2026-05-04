package com.dlp.platform.dto.document;

import com.dlp.platform.entity.DocumentVersion;

import java.time.LocalDateTime;

public class DocumentVersionResponse {
    private Long id;
    private Integer versionNumber;
    private String creator;
    private LocalDateTime createdAt;
    private String description;
    private Long size;

    public DocumentVersionResponse() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Integer getVersionNumber() { return versionNumber; }
    public void setVersionNumber(Integer versionNumber) { this.versionNumber = versionNumber; }

    public String getCreator() { return creator; }
    public void setCreator(String creator) { this.creator = creator; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Long getSize() { return size; }
    public void setSize(Long size) { this.size = size; }

    public static DocumentVersionResponse from(DocumentVersion version) {
        if (version == null) {
            return null;
        }
        DocumentVersionResponse resp = new DocumentVersionResponse();
        resp.setId(version.getId());
        resp.setVersionNumber(version.getVersionNumber());
        resp.setCreator(version.getCreatedBy() != null ? version.getCreatedBy().getFullName() : null);
        resp.setCreatedAt(version.getCreatedAt());
        resp.setDescription(version.getVersionDescription());
        resp.setSize(version.getFileSize());
        return resp;
    }
}
