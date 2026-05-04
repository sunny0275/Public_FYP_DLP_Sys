package com.dlp.platform.dto.document;

import com.dlp.platform.entity.Document;
import com.dlp.platform.entity.Tag;
import com.dlp.platform.entity.User;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Lightweight view model for documents returned to the frontend.
 */
public class DocumentResponse {
    private Long id;
    private String name;
    // Legacy owner field (kept for backward compatibility)
    private String owner;
    // New owner metadata for richer document listing
    private Long ownerId;
    private String ownerName;
    private String department;
    private String classificationLevel;
    private String status;
    private List<String> tags;
    private LocalDateTime updatedAt;
    private LocalDateTime createdAt;
    private Long size;
    private String fileType;
    private Integer pageCount;
    private String description;
    private LocalDateTime expiryDate;
    private Long viewCount;
    private Long downloadCount;
    private Long shareCount;
    // Permission flags
    private Boolean canView;
    private Boolean canDownload;
    private Boolean requiresReview;
    private Boolean hidden;

    public DocumentResponse() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getOwner() { return owner; }
    public void setOwner(String owner) { this.owner = owner; }

    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }

    public String getOwnerName() { return ownerName; }
    public void setOwnerName(String ownerName) { this.ownerName = ownerName; }

    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }

    public String getClassificationLevel() { return classificationLevel; }
    public void setClassificationLevel(String classificationLevel) { this.classificationLevel = classificationLevel; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public Long getSize() { return size; }
    public void setSize(Long size) { this.size = size; }

    public String getFileType() { return fileType; }
    public void setFileType(String fileType) { this.fileType = fileType; }

    public Integer getPageCount() { return pageCount; }
    public void setPageCount(Integer pageCount) { this.pageCount = pageCount; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public LocalDateTime getExpiryDate() { return expiryDate; }
    public void setExpiryDate(LocalDateTime expiryDate) { this.expiryDate = expiryDate; }

    public Long getViewCount() { return viewCount; }
    public void setViewCount(Long viewCount) { this.viewCount = viewCount; }

    public Long getDownloadCount() { return downloadCount; }
    public void setDownloadCount(Long downloadCount) { this.downloadCount = downloadCount; }

    public Long getShareCount() { return shareCount; }
    public void setShareCount(Long shareCount) { this.shareCount = shareCount; }

    public Boolean getCanView() { return canView; }
    public void setCanView(Boolean canView) { this.canView = canView; }

    public Boolean getCanDownload() { return canDownload; }
    public void setCanDownload(Boolean canDownload) { this.canDownload = canDownload; }

    public Boolean getRequiresReview() { return requiresReview; }
    public void setRequiresReview(Boolean requiresReview) { this.requiresReview = requiresReview; }

    public Boolean getHidden() { return hidden; }
    public void setHidden(Boolean hidden) { this.hidden = hidden; }

    /**
     * Map Document entity to response DTO.
     */
    public static DocumentResponse from(Document document) {
        return from(document, null, null);
    }

    /**
     * Map Document entity to response DTO with permission calculation.
     */
    public static DocumentResponse from(Document document, User currentUser) {
        return from(document, currentUser, null);
    }

    /**
     * Map Document entity to response DTO with permission calculation.
     * When sharedDocumentIds contains document ID, grants canView for share recipients (cross-department).
     */
    public static DocumentResponse from(Document document, User currentUser, java.util.Set<Long> sharedDocumentIds) {
        if (document == null) {
            return null;
        }

        DocumentResponse resp = new DocumentResponse();
        resp.setId(document.getId());
        resp.setName(document.getName());
        // Populate legacy owner field plus new owner metadata
        if (document.getOwner() != null) {
            resp.setOwner(document.getOwner().getFullName());
            resp.setOwnerId(document.getOwner().getId());
            resp.setOwnerName(document.getOwner().getFullName());
        }
        resp.setDepartment(document.getDepartment());
        resp.setClassificationLevel(
            document.getClassificationLevel() != null ? document.getClassificationLevel().name() : null
        );
        resp.setStatus(document.getStatus() != null ? document.getStatus().name() : null);
        resp.setRequiresReview(document.getRequiresReview());
        resp.setHidden(document.getHidden());

        if (document.getTags() != null) {
            List<String> tagNames = document.getTags().stream()
                .map(Tag::getName)
                .collect(Collectors.toList());
            resp.setTags(tagNames);
        }

        resp.setUpdatedAt(document.getUpdatedAt());
        resp.setCreatedAt(document.getCreatedAt());
        resp.setSize(document.getFileSize());
        // Prefer mimeType if present, otherwise fileType
        resp.setFileType(document.getMimeType() != null ? document.getMimeType() : document.getFileType());
        resp.setPageCount(document.getPageCount());
        resp.setDescription(document.getDescription());
        resp.setExpiryDate(document.getExpirationDate());
        resp.setViewCount(document.getViewCount());
        resp.setDownloadCount(document.getDownloadCount());
        resp.setShareCount(document.getShareCount());

        // Calculate permissions if currentUser is provided
        if (currentUser != null) {
            boolean hasShareAccess = sharedDocumentIds != null && sharedDocumentIds.contains(document.getId());
            resp.setCanView(hasReadPermission(document, currentUser, hasShareAccess));
            resp.setCanDownload(hasDownloadPermission(document, currentUser, hasShareAccess));
        } else {
            // Default to true if no user provided (for backward compatibility)
            resp.setCanView(true);
            resp.setCanDownload(true);
        }

        return resp;
    }

    /**
     * Check if user has read permission for document
     */
    private static boolean hasReadPermission(Document document, User currentUser, boolean hasShareAccess) {
        Set<String> roles = currentUser.getRoles() != null ? currentUser.getRoles() : Collections.<String>emptySet();

        // REVIEW_REQUIRED documents are restricted to owner/reviewer/admin only.
        if (document.getStatus() == Document.DocumentStatus.REVIEW_REQUIRED ||
            Boolean.TRUE.equals(document.getRequiresReview())) {
            if (document.getOwner() != null && document.getOwner().getId().equals(currentUser.getId())) {
                return true;
            }
            return hasRole(roles, "REVIEWER") || hasRole(roles, "ADMIN");
        }

        // Owner always has read permission
        if (document.getOwner() != null && document.getOwner().getId().equals(currentUser.getId())) {
            return true;
        }

        // Cross-department read: ADMIN only.
        if (hasCrossDepartmentRead(roles)) {
            return true;
        }

        // Explicit internal share grants cross-department visibility.
        if (hasShareAccess) {
            return true;
        }

        // Department-scoped visibility policy:
        // - EMPLOYEE: can view documents in own department up to INTERNAL (PUBLIC/INTERNAL)
        // - MANAGER: can view up to CONFIDENTIAL in own department
        String docDept = document.getDepartment();
        String userDept = currentUser.getDepartment();
        if (docDept == null || userDept == null || !docDept.equals(userDept)) {
            return false;
        }

        boolean isManager = hasRole(roles, "MANAGER");
        Document.ClassificationLevel level = document.getClassificationLevel();
        if (isManager) {
            // Manager can view all classification levels in own department
            return level == Document.ClassificationLevel.PUBLIC
                || level == Document.ClassificationLevel.INTERNAL
                || level == Document.ClassificationLevel.CONFIDENTIAL
                || level == Document.ClassificationLevel.STRICTLY_CONFIDENTIAL;
        }

        return level == Document.ClassificationLevel.PUBLIC || level == Document.ClassificationLevel.INTERNAL;
    }

    /**
     * Check if user has download permission for document
     */
    private static boolean hasDownloadPermission(Document document, User currentUser, boolean hasShareAccess) {
        Set<String> roles = currentUser.getRoles() != null ? currentUser.getRoles() : Collections.<String>emptySet();
        boolean isOwner = document.getOwner() != null && document.getOwner().getId().equals(currentUser.getId());

        // For STRICTLY_CONFIDENTIAL, only owner/admin (or explicit share recipient) can download.
        if (document.getClassificationLevel() == Document.ClassificationLevel.STRICTLY_CONFIDENTIAL) {
            return isOwner || hasAdmin(roles) || hasShareAccess;
        }

        // Otherwise, same as read permission
        return hasReadPermission(document, currentUser, hasShareAccess);
    }

    private static boolean hasCrossDepartmentRead(Set<String> roles) {
        if (roles == null) return false;
        for (String r : roles) {
            String normalized = normalizeRole(r);
            if ("ADMIN".equals(normalized)) {
                return true;
            }
        }
        return false;
    }

    private static boolean hasAdmin(Set<String> roles) {
        if (roles == null) return false;
        for (String r : roles) {
            String normalized = normalizeRole(r);
            if ("ADMIN".equals(normalized)) return true;
        }
        return false;
    }

    private static boolean hasRole(Set<String> roles, String target) {
        if (roles == null || target == null) return false;
        for (String role : roles) {
            if (target.equals(normalizeRole(role))) {
                return true;
            }
        }
        return false;
    }

    private static String normalizeRole(String role) {
        if (role == null) return "";
        String r = role.trim().toUpperCase(java.util.Locale.ROOT);
        if (r.startsWith("ROLE_")) r = r.substring("ROLE_".length());
        return r;
    }
}
