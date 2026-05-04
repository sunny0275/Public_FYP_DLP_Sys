package com.dlp.platform.service.document;

import com.dlp.platform.dto.document.*;
import com.dlp.platform.entity.*;
import com.dlp.platform.entity.DocumentVersion;
import com.dlp.platform.repository.*;
import com.dlp.platform.service.audit.AuditService;
import com.dlp.platform.service.ueba.BulkViewDetectionService;
import com.dlp.platform.service.ueba.UebaScoreService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.security.MessageDigest;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;
import java.util.Arrays;
import java.util.regex.Pattern;

@Service
@Slf4j
@RequiredArgsConstructor
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final TagRepository tagRepository;
    private final DocumentActivityRepository activityRepository;
    private final DocumentVersionRepository versionRepository;
    private final ShareLinkRepository shareLinkRepository;
    private final FileStorageService fileStorageService;
    private final DocumentEncryptionService documentEncryptionService;
    private final TextExtractionService textExtractionService;
    private final WatermarkService watermarkService;
    private final AuditService auditService;
    private final UebaScoreService uebaScoreService;
    private final BulkViewDetectionService bulkViewDetectionService;

    // Debounce VIEW audit logs: only log once per user per document within this time window
    // Prevents flooding audit log with duplicate VIEW entries when user rapidly refreshes page
    private final Map<String, LocalDateTime> lastViewAuditTime = new HashMap<>();
    private static final long VIEW_AUDIT_DEBOUNCE_MS = 60_000; // 1 minute debounce

    /** Get document by ID with permission check.
     * NOTE: VIEW audit logging is NOT done here. 
     * VIEW is logged only when user explicitly clicks "Preview" tab (via POST /documents/{id}/view).
     * This prevents duplicate VIEW logs when page is refreshed or only info is viewed.
     */
    @Transactional
    public DocumentResponse getDocument(Long id, User currentUser, String ipAddress) {
        Document document = documentRepository.findById(id).orElseThrow(() -> new EntityNotFoundException("Document not found"));
        if (!hasReadPermission(document, currentUser)) {
            logActivity(document, currentUser, DocumentActivity.ActivityType.VIEW, DocumentActivity.ActivityResult.DENIED, "Permission denied", ipAddress);
            throw new AccessDeniedException("You do not have permission to view this document");
        }
        document.incrementViewCount();
        documentRepository.save(document);
        // Do NOT log VIEW audit here - only log when user explicitly clicks Preview
        return DocumentResponse.from(document, currentUser);
    }

    /** Record explicit VIEW when user clicks Preview tab.
     * Only call this from the frontend when user navigates to the preview.
     * This ensures VIEW audit is only logged once per session (with debounce).
     */
    @Transactional
    public void recordView(Long id, User currentUser, String ipAddress) {
        Document document = documentRepository.findById(id).orElseThrow(() -> new EntityNotFoundException("Document not found"));
        if (!hasReadPermission(document, currentUser)) {
            logActivity(document, currentUser, DocumentActivity.ActivityType.VIEW, DocumentActivity.ActivityResult.DENIED, "Access denied", ipAddress);
            return;
        }
        logActivity(document, currentUser, DocumentActivity.ActivityType.VIEW, DocumentActivity.ActivityResult.SUCCESS, "Document previewed", ipAddress);
    }

    /** Search and filter documents with DLP policy enforcement */
    @Transactional(readOnly = true)
    public Page<DocumentResponse> searchDocuments(DocumentSearchRequest request, User currentUser) {
        try {
            log.debug("Searching documents - User: {}, Query: {}, Department: {}, Level: {}, Status: {}", 
                currentUser != null ? currentUser.getAccountId() : "null",
                request.getQuery(), request.getDepartment(), request.getClassificationLevel(), request.getStatus());

            if (currentUser == null) {
                log.error("Current user is null in searchDocuments");
                throw new IllegalArgumentException("Current user cannot be null");
            }

            if (currentUser.getId() == null) {
                log.error("Current user ID is null in searchDocuments - User: {}", currentUser.getAccountId());
                throw new IllegalArgumentException("Current user ID cannot be null");
            }

            Pageable pageable = createPageable(request);

            Document.ClassificationLevel levelEnum = null;
            if (request.getClassificationLevel() != null && !request.getClassificationLevel().isEmpty()) {
                try {
                    levelEnum = Document.ClassificationLevel.valueOf(request.getClassificationLevel());
                } catch (IllegalArgumentException e) {
                    log.warn("Invalid classification level: {}", request.getClassificationLevel());
                    throw new IllegalArgumentException("Invalid classification level: " + request.getClassificationLevel());
                }
            }

            Document.DocumentStatus statusEnum = null;
            if (request.getStatus() != null && !request.getStatus().isEmpty()) {
                try {
                    statusEnum = Document.DocumentStatus.valueOf(request.getStatus());
                } catch (IllegalArgumentException e) {
                    log.warn("Invalid document status: {}", request.getStatus());
                    throw new IllegalArgumentException("Invalid document status: " + request.getStatus());
                }
            }

            // Convert tag IDs to tag names if tags are provided
            List<String> tagNames = null;
            if (request.getTags() != null && request.getTags().length > 0) {
                tagNames = Arrays.stream(request.getTags())
                    .map(tagId -> {
                        try {
                            Tag tag = tagRepository.findById(Long.parseLong(tagId)).orElse(null);
                            return tag != null ? tag.getName() : null;
                        } catch (NumberFormatException e) {
                            // If tagId is already a name, use it directly
                            return tagId;
                        }
                    })
                    .filter(java.util.Objects::nonNull)
                    .collect(Collectors.toList());
                
                // If the resulting list is empty, set to null to avoid query issues
                if (tagNames.isEmpty()) {
                    tagNames = null;
                }
            }

            // Handle null department to prevent SQL query issues
            // Pass null instead of empty string to match query logic
            String userDepartment = currentUser.getDepartment();
            if (userDepartment != null && userDepartment.trim().isEmpty()) {
                userDepartment = null;
            }

            log.debug("Search parameters - User ID: {}, User Department: {}, TagNames: {}, Level: {}, Status: {}", 
                currentUser.getId(), userDepartment, tagNames, levelEnum, statusEnum);

            // RBAC flags for database-level filtering
            Set<String> roles = currentUser.getRoles() != null ? currentUser.getRoles() : Collections.emptySet();
            boolean isAdmin = hasRole(roles, "ADMIN");
            boolean isReviewer = hasRole(roles, "REVIEWER");
            boolean isManager = hasRole(roles, "MANAGER");
            // Department isolation policy:
            // non-admin users can only read documents in their own department, unless explicitly shared.
            boolean isCeo = false;
            boolean isSecurityAnalyst = false;
            boolean canReadDeptConfidential = isAdmin || isManager;
            // If status filter is empty, query across all statuses.
            String effectiveStatus = statusEnum != null ? statusEnum.name() : null;

            // Use different query method based on whether tagNames is provided
            Page<Document> documents;
            if (tagNames != null && !tagNames.isEmpty()) {
                log.debug("Using findWithFiltersAndTags query");
                documents = documentRepository.findWithFiltersAndTags(
                    request.getQuery(),
                    request.getDepartment(),
                    request.getClassificationLevel(),
                    effectiveStatus,
                    tagNames,
                    request.getStartDate(),
                    request.getEndDate(),
                    currentUser.getId(),
                    userDepartment,
                    isAdmin,
                    isReviewer,
                    isCeo,
                    isSecurityAnalyst,
                    canReadDeptConfidential,
                    isManager,
                    LocalDateTime.now(),
                    pageable
                );
            } else {
                log.debug("Using findWithFilters query");
                documents = documentRepository.findWithFilters(
                    request.getQuery(),
                    request.getDepartment(),
                    request.getClassificationLevel(),
                    effectiveStatus,
                    request.getStartDate(),
                    request.getEndDate(),
                    currentUser.getId(),
                    userDepartment,
                    isAdmin,
                    isReviewer,
                    isCeo,
                    isSecurityAnalyst,
                    canReadDeptConfidential,
                    isManager,
                    LocalDateTime.now(),
                    pageable
                );
            }

            log.info("Search completed - Found {} documents (page {} of {})", 
                documents.getTotalElements(), documents.getNumber() + 1, documents.getTotalPages());

            java.util.Set<Long> sharedIds = new java.util.HashSet<>(
                shareLinkRepository.findDocumentIdsSharedWithUser(currentUser.getId(), LocalDateTime.now()));
            return documents.map(doc -> DocumentResponse.from(doc, currentUser, sharedIds));
            
        } catch (IllegalArgumentException e) {
            log.error("Invalid search parameters", e);
            throw e;
        } catch (Exception e) {
            log.error("Error searching documents - User: {}, Request: {}", 
                currentUser != null ? currentUser.getAccountId() : "null", request, e);
            throw new RuntimeException("Failed to search documents: " + e.getMessage(), e);
        }
    }

    /** Get recent documents for dashboard */
    @Transactional(readOnly = true)
    public List<DocumentResponse> getRecentDocuments(User currentUser, int limit) {
        return documentRepository.findTop10ByOwnerOrderByUpdatedAtDesc(currentUser).stream()
            .limit(limit).map(doc -> DocumentResponse.from(doc, currentUser)).collect(Collectors.toList());
    }

    /** Update document metadata */
    @Transactional
    public DocumentResponse updateDocument(Long id, DocumentUploadRequest request, User currentUser, String ipAddress) {
        Document document = documentRepository.findById(id).orElseThrow(() -> new EntityNotFoundException("Document not found"));
        if (!hasWritePermission(document, currentUser)) {
            logActivity(document, currentUser, DocumentActivity.ActivityType.UPDATE, DocumentActivity.ActivityResult.DENIED, "Permission denied", ipAddress);
            throw new AccessDeniedException("You do not have permission to update this document");
        }
        if (request.getName() != null) document.setName(request.getName());
        if (request.getDescription() != null) document.setDescription(request.getDescription());
        if (request.getDepartment() != null) document.setDepartment(request.getDepartment());
        if (request.getExpirationDate() != null) document.setExpirationDate(request.getExpirationDate());
        if (request.getTags() != null) { Set<Tag> tags = getOrCreateTags(request.getTags()); document.setTags(tags); }
        if (request.getClassificationLevel() != null) {
            Document.ClassificationLevel newLevel = Document.ClassificationLevel.valueOf(request.getClassificationLevel());
            document.setClassificationLevel(newLevel);
            document.setRequiresReview(false);
        }
        Document savedDocument = documentRepository.save(document);
        logActivity(document, currentUser, DocumentActivity.ActivityType.UPDATE, DocumentActivity.ActivityResult.SUCCESS, "Document metadata updated", ipAddress);
        return DocumentResponse.from(savedDocument, currentUser);
    }

    /** Delete document (soft delete by changing status) */
    @Transactional
    public void deleteDocument(Long id, User currentUser, String ipAddress) {
        Document document = documentRepository.findById(id).orElseThrow(() -> new EntityNotFoundException("Document not found"));
        if (!hasDeletePermission(document, currentUser)) {
            logActivity(document, currentUser, DocumentActivity.ActivityType.DELETE, DocumentActivity.ActivityResult.DENIED, "Permission denied", ipAddress);
            throw new AccessDeniedException("You do not have permission to delete this document");
        }
        document.setStatus(Document.DocumentStatus.ARCHIVED);
        documentRepository.save(document);
        logActivity(document, currentUser, DocumentActivity.ActivityType.DELETE, DocumentActivity.ActivityResult.SUCCESS, "Document archived", ipAddress);
        log.info("Document {} archived by user {}", id, currentUser.getAccountId());
    }

    /** Download document with permission check */
    @Transactional
    public byte[] downloadDocument(Long id, User currentUser, String ipAddress) throws IOException {
        Document document = documentRepository.findById(id).orElseThrow(() -> new EntityNotFoundException("Document not found"));
        if (!hasDownloadPermission(document, currentUser)) {
            logActivity(document, currentUser, DocumentActivity.ActivityType.DOWNLOAD, DocumentActivity.ActivityResult.DENIED, "Permission denied", ipAddress);
            throw new AccessDeniedException("You do not have permission to download this document");
        }
        document.incrementDownloadCount();
        documentRepository.save(document);
        logActivity(document, currentUser, DocumentActivity.ActivityType.DOWNLOAD, DocumentActivity.ActivityResult.SUCCESS, "Document downloaded", ipAddress);
        byte[] content = documentEncryptionService.readDecryptedDocumentContent(document);
        String fileType = document.getMimeType() != null ? document.getMimeType() : document.getFileType();
        if (fileType != null && fileType.equals("application/pdf") && watermarkService.supportsWatermark(fileType)) {
            return watermarkService.applyWatermarkAndEncryptPdfForDownload(content, currentUser, document.getId());
        }
        if (fileType != null && watermarkService.supportsWatermark(fileType)) {
            return watermarkService.applyWatermark(content, fileType, currentUser, ipAddress, document.getId());
        }
        return content;
    }

    /** Compute SHA-256 hash of raw file content for signing/verification */
    @Transactional(readOnly = true)
    public String getDocumentContentHash(Long id, User currentUser, String ipAddress) throws IOException {
        Document document = documentRepository.findById(id).orElseThrow(() -> new EntityNotFoundException("Document not found"));
        if (!hasReadPermission(document, currentUser)) throw new AccessDeniedException("You do not have permission to view this document");
        byte[] raw = documentEncryptionService.readDecryptedDocumentContent(document);
        return sha256Hex(raw);
    }

    private static String sha256Hex(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(bytes);
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException("Failed to compute SHA-256 hash", e);
        }
    }

    /** Internal method to get document content hash without permission checks. Used by signature service. */
    @Transactional(readOnly = true)
    public String getDocumentContentHashInternal(Long documentId) throws IOException {
        Document document = documentRepository.findById(documentId).orElseThrow(() -> new EntityNotFoundException("Document not found"));
        return sha256Hex(documentEncryptionService.readDecryptedDocumentContent(document));
    }

    /** Result of a document preview request */
    public static class PreviewResult {
        private final byte[] content;
        private final String shortCode;
        private final String appliedIp;
        private final String fileType;

        public PreviewResult(byte[] content, String shortCode, String appliedIp) {
            this(content, shortCode, appliedIp, null);
        }

        public PreviewResult(byte[] content, String shortCode, String appliedIp, String fileType) {
            this.content = content;
            this.shortCode = shortCode;
            this.appliedIp = appliedIp;
            this.fileType = fileType;
        }

        public byte[] getContent() { return content; }
        public String getShortCode() { return shortCode; }
        public String getAppliedIp() { return appliedIp; }
        public String getFileType() { return fileType; }
    }

    /** Get document content for preview with watermark */
    @Transactional
    public PreviewResult getDocumentContentForPreview(Long id, User currentUser, String ipAddress) throws IOException {
        Document document = documentRepository.findById(id).orElseThrow(() -> new EntityNotFoundException("Document not found"));
        if (!hasViewPermission(document, currentUser)) {
            logActivity(document, currentUser, DocumentActivity.ActivityType.VIEW, DocumentActivity.ActivityResult.DENIED, "Permission denied", ipAddress);
            throw new AccessDeniedException("You do not have permission to view this document");
        }
        document.incrementViewCount();
        documentRepository.save(document);
        logActivity(document, currentUser, DocumentActivity.ActivityType.VIEW, DocumentActivity.ActivityResult.SUCCESS, "Document previewed", ipAddress);
        try {
            byte[] fileContent = documentEncryptionService.readDecryptedDocumentContent(document);
            String fileType = document.getFileType();
            if (watermarkService.supportsWatermark(fileType)) {
                WatermarkService.WatermarkResult result = watermarkService.applyWatermarkForPreview(fileContent, fileType, currentUser, ipAddress, document.getId());
                return new PreviewResult(result.getContent(), result.getShortCode(), result.getAppliedIp(), fileType);
            }
            return new PreviewResult(fileContent, null, ipAddress, fileType);
        } catch (IOException e) {
            log.error("Error reading file for document {} (filePath: {}): {}", document.getId(), document.getFilePath(), e.getMessage(), e);
            throw new IOException("Failed to read document file: " + e.getMessage(), e);
        }
    }

    /** Get document version history */
    @Transactional
    public List<DocumentVersionResponse> getDocumentVersions(Long id, User currentUser, String ipAddress) {
        Document document = documentRepository.findById(id).orElseThrow(() -> new EntityNotFoundException("Document not found"));
        if (!hasViewPermission(document, currentUser)) {
            logActivity(document, currentUser, DocumentActivity.ActivityType.VIEW, DocumentActivity.ActivityResult.DENIED, "Permission denied to view versions", ipAddress);
            throw new AccessDeniedException("You do not have permission to view document versions");
        }
        List<DocumentVersion> versions = versionRepository.findByDocumentIdOrderByVersionNumberDesc(document.getId());
        log.info("Retrieved {} version(s) for document: {}", versions.size(), document.getId());
        return versions.stream().map(DocumentVersionResponse::from).collect(Collectors.toList());
    }

    /** Restore document to a specific version */
    @Transactional
    public DocumentResponse restoreDocumentVersion(Long documentId, Long versionId, User currentUser, String ipAddress) {
        Document document = documentRepository.findById(documentId).orElseThrow(() -> new EntityNotFoundException("Document not found"));
        if (!hasWritePermission(document, currentUser)) {
            logActivity(document, currentUser, DocumentActivity.ActivityType.VERSION_RESTORE, DocumentActivity.ActivityResult.DENIED, "Permission denied to restore version", ipAddress);
            throw new AccessDeniedException("You do not have permission to restore document versions");
        }
        DocumentVersion targetVersion = versionRepository.findById(versionId).orElseThrow(() -> new EntityNotFoundException("Version not found"));
        if (!targetVersion.getDocument().getId().equals(documentId)) throw new IllegalArgumentException("Version does not belong to this document");

        // Save current version before restoring
        DocumentVersion currentVersion = DocumentVersion.builder().document(document).versionNumber(document.getVersion())
            .filePath(document.getFilePath()).fileName(document.getFileName()).fileSize(document.getFileSize())
            .contentHash(document.getContentHash()).createdBy(currentUser)
            .versionDescription("Auto-saved before restoring to version " + targetVersion.getVersionNumber()).build();
        versionRepository.save(currentVersion);

        try {
            byte[] versionContent = fileStorageService.readFile(targetVersion.getFilePath());
            String newFilePath = fileStorageService.storeFileFromBytes(versionContent, document.getDepartment(), targetVersion.getFileName());
            String newContentHash;
            try { newContentHash = fileStorageService.calculateFileHash(newFilePath);
            } catch (java.security.NoSuchAlgorithmException e) { throw new RuntimeException("Failed to calculate file hash", e); }

            document.setFilePath(newFilePath);
            document.setFileName(targetVersion.getFileName());
            document.setFileSize(targetVersion.getFileSize());
            document.setContentHash(newContentHash);
            document.setVersion(document.getVersion() + 1);
            document.setUpdatedAt(LocalDateTime.now());
            Document savedDocument = documentRepository.save(document);
            logActivity(document, currentUser, DocumentActivity.ActivityType.VERSION_RESTORE, DocumentActivity.ActivityResult.SUCCESS, "Restored to version " + targetVersion.getVersionNumber(), ipAddress);
            log.info("Document {} restored to version {} by user {}", documentId, targetVersion.getVersionNumber(), currentUser.getAccountId());
            return DocumentResponse.from(savedDocument, currentUser);
        } catch (IOException e) { throw new RuntimeException("Failed to restore document version: " + e.getMessage()); }
    }

    /** Compare two document versions */
    @Transactional
    public Map<String, Object> compareDocumentVersions(Long documentId, Long versionId1, Long versionId2, User currentUser, String ipAddress) {
        Document document = documentRepository.findById(documentId).orElseThrow(() -> new EntityNotFoundException("Document not found"));
        if (!hasViewPermission(document, currentUser)) {
            logActivity(document, currentUser, DocumentActivity.ActivityType.VIEW, DocumentActivity.ActivityResult.DENIED, "Permission denied to compare versions", ipAddress);
            throw new AccessDeniedException("You do not have permission to compare document versions");
        }
        DocumentVersion version1 = versionRepository.findById(versionId1).orElseThrow(() -> new EntityNotFoundException("Version 1 not found"));
        DocumentVersion version2 = versionRepository.findById(versionId2).orElseThrow(() -> new EntityNotFoundException("Version 2 not found"));
        if (!version1.getDocument().getId().equals(documentId) || !version2.getDocument().getId().equals(documentId)) {
            throw new IllegalArgumentException("Versions do not belong to this document");
        }

        Map<String, Object> comparison = new HashMap<>();
        comparison.put("version1", DocumentVersionResponse.from(version1));
        comparison.put("version2", DocumentVersionResponse.from(version2));
        comparison.put("sizeDifference", version2.getFileSize() - version1.getFileSize());
        comparison.put("timeDifference", java.time.Duration.between(version1.getCreatedAt(), version2.getCreatedAt()).toDays());

        try {
            String text1 = extractTextFromVersion(version1);
            String text2 = extractTextFromVersion(version2);
            if (text1 != null && text2 != null) {
                comparison.put("text1", text1);
                comparison.put("text2", text2);
                comparison.put("textSimilarity", calculateTextSimilarity(text1, text2));
            }
        } catch (Exception e) { log.debug("Could not extract text for comparison: {}", e.getMessage()); }

        logActivity(document, currentUser, DocumentActivity.ActivityType.VIEW, DocumentActivity.ActivityResult.SUCCESS,
            "Compared versions " + version1.getVersionNumber() + " and " + version2.getVersionNumber(), ipAddress);
        return comparison;
    }

    private String extractTextFromVersion(DocumentVersion version) {
        try { return new String(fileStorageService.readFile(version.getFilePath())).substring(0, Math.min(1000, fileStorageService.readFile(version.getFilePath()).length)); }
        catch (Exception e) { return null; }
    }

    private double calculateTextSimilarity(String text1, String text2) {
        int maxLen = Math.max(text1.length(), text2.length());
        if (maxLen == 0) return 1.0;
        return 1.0 - ((double) levenshteinDistance(text1, text2) / maxLen);
    }

    private int levenshteinDistance(String s1, String s2) {
        int[][] dp = new int[s1.length() + 1][s2.length() + 1];
        for (int i = 0; i <= s1.length(); i++) {
            for (int j = 0; j <= s2.length(); j++) {
                if (i == 0) dp[i][j] = j;
                else if (j == 0) dp[i][j] = i;
                else dp[i][j] = Math.min(Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1), dp[i - 1][j - 1] + (s1.charAt(i - 1) == s2.charAt(j - 1) ? 0 : 1));
            }
        }
        return dp[s1.length()][s2.length()];
    }

    /** Batch export documents */
    @Transactional
    public Map<String, Object> batchExportDocuments(List<Long> documentIds, User currentUser, String ipAddress) throws IOException {
        Map<String, Object> result = new HashMap<>();
        List<Long> exportedIds = new ArrayList<>();
        List<Map<String, Object>> deniedDocs = new ArrayList<>();

        for (Long docId : documentIds) {
            try {
                Document document = documentRepository.findById(docId)
                    .orElseThrow(() -> new EntityNotFoundException("Document not found: " + docId));

                // Check export permission
                if (!hasReadPermission(document, currentUser)) {
                    deniedDocs.add(Map.of(
                        "documentId", docId,
                        "documentName", document.getName(),
                        "reason", "No permission to export"
                    ));
                    logActivity(document, currentUser, DocumentActivity.ActivityType.DOWNLOAD,
                        DocumentActivity.ActivityResult.DENIED, "Batch export denied: no permission", ipAddress);
                    continue;
                }

                // Check if document can be exported (policy evaluation)
                if (document.getClassificationLevel() == Document.ClassificationLevel.STRICTLY_CONFIDENTIAL) {
                    deniedDocs.add(Map.of(
                        "documentId", docId,
                        "documentName", document.getName(),
                        "reason", "Strictly confidential documents cannot be exported"
                    ));
                    logActivity(document, currentUser, DocumentActivity.ActivityType.DOWNLOAD,
                        DocumentActivity.ActivityResult.DENIED, "Batch export denied: policy restriction", ipAddress);
                    continue;
                }

                exportedIds.add(docId);
                logActivity(document, currentUser, DocumentActivity.ActivityType.DOWNLOAD,
                    DocumentActivity.ActivityResult.SUCCESS, "Batch export", ipAddress);
            } catch (Exception e) {
                log.error("Error exporting document {}", docId, e);
                deniedDocs.add(Map.of(
                    "documentId", docId,
                    "documentName", "Unknown",
                    "reason", "Error: " + e.getMessage()
                ));
            }
        }

        // Generate export package (ZIP file with watermarked documents)
        if (!exportedIds.isEmpty()) {
            String exportFilePath = generateBatchExportPackage(exportedIds, currentUser, ipAddress);
            result.put("exportFilePath", exportFilePath);
            result.put("exportedCount", exportedIds.size());
            result.put("exportedIds", exportedIds);
        }

        result.put("deniedCount", deniedDocs.size());
        result.put("deniedDocuments", deniedDocs);
        result.put("totalCount", documentIds.size());

        log.info("Batch export completed: {} exported, {} denied", exportedIds.size(), deniedDocs.size());
        return result;
    }

    /** Generate batch export package (ZIP file) */
    private String generateBatchExportPackage(List<Long> documentIds, User currentUser, String ipAddress) throws IOException {
        String zipFileName = "batch_export_" + System.currentTimeMillis() + ".zip";
        Path uploadDir = Paths.get("./uploads");
        Path zipPath = uploadDir.resolve("exports").resolve(zipFileName);
        Files.createDirectories(zipPath.getParent());
        try (java.util.zip.ZipOutputStream zos = new java.util.zip.ZipOutputStream(Files.newOutputStream(zipPath))) {
            for (Long docId : documentIds) {
                Document document = documentRepository.findById(docId).orElse(null);
                if (document == null) continue;
                try {
                    byte[] fileContent = documentEncryptionService.readDecryptedDocumentContent(document);
                    if (watermarkService.supportsWatermark(document.getFileType())) {
                        fileContent = watermarkService.applyWatermark(fileContent, document.getFileType(), currentUser, ipAddress, document.getId());
                    }
                    java.util.zip.ZipEntry entry = new java.util.zip.ZipEntry(document.getFileName());
                    zos.putNextEntry(entry);
                    zos.write(fileContent);
                    zos.closeEntry();
                } catch (Exception e) { log.error("Error adding document {} to export package", docId, e); }
            }
        }
        return zipPath.toString();
    }

    /** Download batch export ZIP file */
    @Transactional(readOnly = true)
    public byte[] downloadBatchExportFile(String filePath, User currentUser, String ipAddress) throws IOException {
        Path path = Paths.get(filePath).normalize().toAbsolutePath();
        Path uploadDir = Paths.get("./uploads").toAbsolutePath().normalize();
        if (!path.startsWith(uploadDir.resolve("exports"))) throw new SecurityException("Invalid export file path");
        if (!Files.exists(path)) throw new IOException("Export file not found");
        return Files.readAllBytes(path);
    }

    /** Batch share documents */
    @Transactional
    public Map<String, Object> batchShareDocuments(List<Long> documentIds, String shareType, List<String> recipients, String permissions, String expireAt, User currentUser, String ipAddress) {
        Map<String, Object> result = new HashMap<>();
        List<Long> sharedIds = new ArrayList<>();
        List<Map<String, Object>> deniedDocs = new ArrayList<>();

        for (Long docId : documentIds) {
            try {
                Document document = documentRepository.findById(docId)
                    .orElseThrow(() -> new EntityNotFoundException("Document not found: " + docId));

                // Check share permission
                if (!canShare(document, currentUser)) {
                    deniedDocs.add(Map.of(
                        "documentId", docId,
                        "documentName", document.getName(),
                        "reason", "No permission to share"
                    ));
                    logActivity(document, currentUser, DocumentActivity.ActivityType.SHARE,
                        DocumentActivity.ActivityResult.DENIED, "Batch share denied: no permission", ipAddress);
                    continue;
                }

                // Check share policy
                if (shareType != null && shareType.equals("EXTERNAL")) {
                    if (document.getClassificationLevel() == Document.ClassificationLevel.STRICTLY_CONFIDENTIAL ||
                        document.getClassificationLevel() == Document.ClassificationLevel.CONFIDENTIAL) {
                        deniedDocs.add(Map.of(
                            "documentId", docId,
                            "documentName", document.getName(),
                            "reason", "High classification level requires approval for external sharing"
                        ));
                        logActivity(document, currentUser, DocumentActivity.ActivityType.SHARE,
                            DocumentActivity.ActivityResult.DENIED, "Batch share denied: policy restriction", ipAddress);
                        continue;
                    }
                }

                sharedIds.add(docId);
                logActivity(document, currentUser, DocumentActivity.ActivityType.SHARE,
                    DocumentActivity.ActivityResult.SUCCESS, "Batch share", ipAddress);
            } catch (Exception e) {
                log.error("Error sharing document {}", docId, e);
                deniedDocs.add(Map.of(
                    "documentId", docId,
                    "documentName", "Unknown",
                    "reason", "Error: " + e.getMessage()
                ));
            }
        }

        result.put("sharedCount", sharedIds.size());
        result.put("sharedIds", sharedIds);
        result.put("deniedCount", deniedDocs.size());
        result.put("deniedDocuments", deniedDocs);
        result.put("totalCount", documentIds.size());

        // Note: Actual share link creation should be done by ShareLinkService
        // This method only validates permissions and returns allowed/denied lists

        log.info("Batch share validation completed: {} allowed, {} denied", sharedIds.size(), deniedDocs.size());
        return result;
    }

    /** Check if user can share document */
    private boolean canShare(Document document, User currentUser) {
        if (document == null || currentUser == null || currentUser.getId() == null || document.getOwner() == null) return false;
        if (!document.getOwner().getId().equals(currentUser.getId())) return false;
        return Boolean.TRUE.equals(document.getAllowShare());
    }

    /** Download a specific document version */
    @Transactional(readOnly = true)
    public byte[] downloadDocumentVersion(Long documentId, Long versionId, User currentUser, String ipAddress) throws IOException {
        Document document = documentRepository.findById(documentId).orElseThrow(() -> new EntityNotFoundException("Document not found"));
        if (!hasReadPermission(document, currentUser)) {
            logActivity(document, currentUser, DocumentActivity.ActivityType.DOWNLOAD, DocumentActivity.ActivityResult.DENIED, "Permission denied to download version", ipAddress);
            throw new AccessDeniedException("You do not have permission to download this version");
        }
        DocumentVersion version = versionRepository.findById(versionId).orElseThrow(() -> new EntityNotFoundException("Version not found"));
        if (!version.getDocument().getId().equals(documentId)) throw new IllegalArgumentException("Version does not belong to this document");
        byte[] fileContent = fileStorageService.readFile(version.getFilePath());
        logActivity(document, currentUser, DocumentActivity.ActivityType.DOWNLOAD, DocumentActivity.ActivityResult.SUCCESS, "Downloaded version " + version.getVersionNumber(), ipAddress);
        String fileType = document.getMimeType() != null ? document.getMimeType() : document.getFileType();
        if (fileType != null && fileType.equals("application/pdf") && watermarkService.supportsWatermark(fileType)) {
            return watermarkService.applyWatermarkAndEncryptPdfForDownload(fileContent, currentUser, document.getId());
        }
        if (fileType != null && watermarkService.supportsWatermark(fileType)) {
            return watermarkService.applyWatermark(fileContent, fileType, currentUser, ipAddress, document.getId());
        }
        return fileContent;
    }

    /** Get version by ID */
    @Transactional(readOnly = true)
    public DocumentVersion getVersionById(Long versionId) { return versionRepository.findById(versionId).orElse(null); }

    /** Get document activity log */
    @Transactional
    public List<DocumentActivityResponse> getDocumentActivity(Long id, User currentUser, String ipAddress) {
        Document document = documentRepository.findById(id).orElseThrow(() -> new EntityNotFoundException("Document not found"));
        if (!hasViewPermission(document, currentUser)) {
            logActivity(document, currentUser, DocumentActivity.ActivityType.VIEW, DocumentActivity.ActivityResult.DENIED, "Permission denied to view activity", ipAddress);
            throw new AccessDeniedException("You do not have permission to view document activity");
        }
        List<DocumentActivity> activities = activityRepository.findByDocumentOrderByTimestampDesc(document);
        log.info("Retrieved {} activity record(s) for document: {}", activities.size(), document.getId());
        return activities.stream().map(DocumentActivityResponse::from).collect(Collectors.toList());
    }

    /** Get all tags */
    @Transactional(readOnly = true)
    public List<TagResponse> getAllTags() { return tagRepository.findAll().stream().map(TagResponse::from).collect(Collectors.toList()); }

    /** Create or get existing tags */
    @Transactional
    public Set<Tag> getOrCreateTags(Set<String> tagNames) {
        Set<Tag> tags = new HashSet<>();
        for (String tagName : tagNames) {
            Tag tag = tagRepository.findByName(tagName)
                .orElseGet(() -> {
                    String normalized = tagName != null ? tagName.trim().toLowerCase(java.util.Locale.ROOT) : "";
                    // Deterministic colors for high-signal tags (improves UX)
                    java.util.Map<String, String> colorMap = java.util.Map.ofEntries(
                        java.util.Map.entry("pii-detected", "#d32f2f"),
                        java.util.Map.entry("pii-high-risk", "#b71c1c"),
                        java.util.Map.entry("pii-credit-card", "#c62828"),
                        java.util.Map.entry("pii-bank-account", "#ad1457"),
                        java.util.Map.entry("finance-detected", "#2e7d32"),
                        java.util.Map.entry("finance-sensitive", "#1b5e20"),
                        java.util.Map.entry("customer-data", "#f57c00"),
                        java.util.Map.entry("customer-data-detected", "#ef6c00"),
                        java.util.Map.entry("contract-detected", "#5d4037"),
                        java.util.Map.entry("payroll-detected", "#283593"),
                        java.util.Map.entry("hr", "#1976d2"),
                        java.util.Map.entry("finance", "#2e7d32"),
                        java.util.Map.entry("legal", "#5d4037"),
                        java.util.Map.entry("invoice", "#455a64"),
                        java.util.Map.entry("meeting-minutes", "#1565c0")
                    );
                    String color = colorMap.getOrDefault(normalized, "#" + Integer.toHexString(new Random().nextInt(0xFFFFFF)));
                    Tag newTag = Tag.builder()
                        .name(tagName)
                        .color(color)
                        .build();
                    return tagRepository.save(newTag);
                });
            tags.add(tag);
        }
        return tags;
    }

    private boolean hasReadPermission(Document document, User currentUser) {
        if (Boolean.TRUE.equals(document.getHidden())) return false;
        Set<String> roles = currentUser.getRoles() != null ? currentUser.getRoles() : Collections.emptySet();

        if (document.getStatus() == Document.DocumentStatus.REVIEW_REQUIRED || Boolean.TRUE.equals(document.getRequiresReview())) {
            if (document.getOwner().getId().equals(currentUser.getId())) return true;
            boolean isReviewer = roles.stream().anyMatch(r -> normalizeRole(r).equals("REVIEWER"));
            if (isReviewer) return true;
            boolean isAdmin = roles.stream().anyMatch(r -> normalizeRole(r).equals("ADMIN"));
            if (isAdmin) return true;
            return false;
        }

        if (document.getOwner().getId().equals(currentUser.getId())) return true;
        if (hasCrossDepartmentRead(roles)) return true;
        if (shareLinkRepository.findDocumentIdsSharedWithUser(currentUser.getId(), LocalDateTime.now()).contains(document.getId())) return true;

        String docDept = document.getDepartment();
        String userDept = currentUser.getDepartment();
        if (docDept == null || userDept == null || !docDept.equals(userDept)) return false;

        boolean isManager = roles.stream().anyMatch(r -> normalizeRole(r).equals("MANAGER"));
        if (isManager) return true;

        return document.getClassificationLevel() == Document.ClassificationLevel.PUBLIC || document.getClassificationLevel() == Document.ClassificationLevel.INTERNAL;
    }

    private boolean hasCrossDepartmentRead(Set<String> roles) {
        if (roles == null) return false;
        for (String r : roles) {
            String normalized = normalizeRole(r);
            if ("ADMIN".equals(normalized)) {
                return true;
            }
        }
        return false;
    }

    private boolean hasRole(Set<String> roles, String target) {
        if (roles == null || target == null) return false;
        for (String role : roles) {
            if (target.equals(normalizeRole(role))) {
                return true;
            }
        }
        return false;
    }

    private String normalizeRole(String role) {
        if (role == null) return "";
        String r = role.trim().toUpperCase(java.util.Locale.ROOT);
        if (r.startsWith("ROLE_")) r = r.substring("ROLE_".length());
        return r;
    }

    private boolean hasWritePermission(Document document, User currentUser) {
        Set<String> roles = currentUser.getRoles() != null ? currentUser.getRoles() : Collections.emptySet();
        if (roles.contains("ADMIN")) return true;
        if (document.getOwner().getId().equals(currentUser.getId())) return true;
        if (document.getDepartment() != null && document.getDepartment().equals(currentUser.getDepartment())) {
            if (document.getClassificationLevel() == Document.ClassificationLevel.STRICTLY_CONFIDENTIAL) return false;
            return roles.contains("MANAGER");
        }
        return false;
    }

    /** Owner and ADMIN can always delete; otherwise MANAGER can delete for dept docs. */
    private boolean hasDeletePermission(Document document, User currentUser) {
        if (currentUser == null || currentUser.getId() == null) return false;
        Set<String> roles = currentUser.getRoles() != null ? currentUser.getRoles() : Collections.emptySet();
        if (roles.contains("ADMIN")) return true;
        if (document.getOwner() != null && currentUser.getId().equals(document.getOwner().getId())) return true;
        return hasWritePermission(document, currentUser);
    }

    private boolean hasViewPermission(Document document, User currentUser) { return hasReadPermission(document, currentUser); }

    private boolean hasDownloadPermission(Document document, User currentUser) {
        Set<String> roles = currentUser.getRoles() != null ? currentUser.getRoles() : Collections.emptySet();
        if (document.getClassificationLevel() == Document.ClassificationLevel.STRICTLY_CONFIDENTIAL) {
            if (document.getOwner().getId().equals(currentUser.getId()) || hasAdmin(roles)) return true;
            return shareLinkRepository.findDocumentIdsSharedWithUser(currentUser.getId(), LocalDateTime.now()).contains(document.getId());
        }
        return hasReadPermission(document, currentUser);
    }

    private boolean hasAdmin(Set<String> roles) {
        if (roles == null) return false;
        for (String r : roles) {
            String normalized = normalizeRole(r);
            if ("ADMIN".equals(normalized)) return true;
        }
        return false;
    }

    /**
     * Log document activity (document_activities table and audit_log for Recent Audit Logs).
     * Also triggers bulk view detection for VIEW activities.
     * 
     * Debounce logic: For VIEW events with SUCCESS result, only log to audit once per user per document
     * within a 60-second window. This prevents flooding the audit log when users rapidly refresh pages.
     */
    private void logActivity(Document document, User user, DocumentActivity.ActivityType type,
                            DocumentActivity.ActivityResult result, String details, String ipAddress) {
        DocumentActivity activity = DocumentActivity.builder()
            .document(document)
            .user(user)
            .activityType(type)
            .result(result)
            .details(details)
            .ipAddress(ipAddress)
            .build();
        activityRepository.save(activity);
        String docRef = document.getName() != null ? "doc=\"" + document.getName() + "\" (id=" + document.getId() + ")" : "docId=" + document.getId();
        
        // Debounce VIEW audit logs: only send to audit_log once per user per document within 60 seconds
        boolean shouldLogToAudit = true;
        if (type == DocumentActivity.ActivityType.VIEW && result == DocumentActivity.ActivityResult.SUCCESS && user != null) {
            String debounceKey = user.getAccountId() + ":" + document.getId();
            LocalDateTime now = LocalDateTime.now();
            LocalDateTime lastLog = lastViewAuditTime.get(debounceKey);
            
            if (lastLog != null && java.time.Duration.between(lastLog, now).toMillis() < VIEW_AUDIT_DEBOUNCE_MS) {
                shouldLogToAudit = false; // Skip audit log, but still log to document_activity
                log.debug("Debounced VIEW audit for user={} doc={} (last log {}ms ago)",
                    user.getAccountId(), document.getId(), java.time.Duration.between(lastLog, now).toMillis());
            } else {
                lastViewAuditTime.put(debounceKey, now);
            }
        }
        
        if (shouldLogToAudit) {
            auditService.logDocumentAction(
                user != null ? user.getId() : null,
                user != null ? user.getAccountId() : null,
                type.name(),
                result.name(),
                docRef + (details != null && !details.isEmpty() ? ": " + details : ""),
                ipAddress != null ? ipAddress : "UNKNOWN"
            );
        }

        // Trigger bulk view detection for VIEW activities (always, not debounced)
        if (type == DocumentActivity.ActivityType.VIEW && user != null && result == DocumentActivity.ActivityResult.SUCCESS) {
            bulkViewDetectionService.checkBulkView(user.getId(), user.getAccountId(), ipAddress);
        }

        if (user != null && result == DocumentActivity.ActivityResult.DENIED) {
            uebaScoreService.deductForFailure(user.getId(), user.getAccountId(), docRef + ": " + (details != null ? details : ""), ipAddress != null ? ipAddress : "UNKNOWN");
        }
    }

    /**
     * Create pageable from search request
     */
    private Pageable createPageable(DocumentSearchRequest request) {
        int page = request.getPage() != null ? request.getPage() : 0;
        int size = request.getPageSize() != null ? request.getPageSize() : 20;
        return PageRequest.of(page, size, Sort.unsorted());
    }

    /**
     * Get documents requiring review
     */
    @Transactional(readOnly = true)
    public Page<DocumentResponse> getDocumentsRequiringReview(int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return documentRepository.findDocumentsRequiringReview(Document.DocumentStatus.REVIEW_REQUIRED, pageable).map(DocumentResponse::from);
    }

    /**
     * Get raw document content (no watermark). Used by ShareController for public preview.
     */
    @Transactional(readOnly = true)
    public byte[] getDocumentContent(Long id) throws IOException {
        Document document = documentRepository.findById(id).orElseThrow(() -> new EntityNotFoundException("Document not found"));
        return documentEncryptionService.readDecryptedDocumentContent(document);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> generateSafeSummary(Long id, User currentUser, String ipAddress, int maxChars) throws IOException {
        Document document = documentRepository.findById(id).orElseThrow(() -> new EntityNotFoundException("Document not found"));
        if (!hasReadPermission(document, currentUser)) {
            logActivity(document, currentUser, DocumentActivity.ActivityType.VIEW, DocumentActivity.ActivityResult.DENIED, "Permission denied for summary generation", ipAddress);
            throw new AccessDeniedException("You do not have permission to summarize this document");
        }
        return buildSafeSummaryMap(document, maxChars);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> generateSafeSummaryForSharedDocument(Long id, int maxChars) throws IOException {
        Document document = documentRepository.findById(id).orElseThrow(() -> new EntityNotFoundException("Document not found"));
        return buildSafeSummaryMap(document, maxChars);
    }

    @Transactional
    public Map<String, Object> reEncryptDocument(Long id, User currentUser, String ipAddress) throws IOException {
        Document document = documentRepository.findById(id).orElseThrow(() -> new EntityNotFoundException("Document not found"));
        boolean canManage = document.getOwner() != null && currentUser != null && document.getOwner().getId().equals(currentUser.getId());
        if (!canManage) {
            Set<String> roles = currentUser != null && currentUser.getRoles() != null ? currentUser.getRoles() : Collections.emptySet();
            canManage = roles.contains("ADMIN") || roles.contains("ROLE_ADMIN") || roles.contains("SECURITY_ANALYST") || roles.contains("ROLE_SECURITY_ANALYST");
        }
        if (!canManage) throw new AccessDeniedException("You do not have permission to re-encrypt this document");
        documentEncryptionService.reEncryptDocumentAtRest(document);
        logActivity(document, currentUser, DocumentActivity.ActivityType.UPDATE, DocumentActivity.ActivityResult.SUCCESS, "Document re-encrypted", ipAddress);
        return Map.of("documentId", document.getId(), "status", "COMPLETED", "encrypted", document.getEncrypted(), "updatedAt", LocalDateTime.now().toString());
    }

    @Transactional
    public Map<String, Object> batchReEncryptDocuments(List<Long> documentIds, User currentUser, String ipAddress) {
        List<Map<String, Object>> items = new ArrayList<>();
        int success = 0, failed = 0;
        for (Long id : documentIds) {
            try { Map<String, Object> item = reEncryptDocument(id, currentUser, ipAddress); items.add(item); success++; }
            catch (Exception e) { failed++; items.add(Map.of("documentId", id, "status", "FAILED", "error", e.getMessage())); }
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("requested", documentIds != null ? documentIds.size() : 0);
        response.put("success", success);
        response.put("failed", failed);
        response.put("items", items);
        return response;
    }

    /**
     * Get document details by ID without permission checks. Used by ShareController for anonymous preview.
     */
    @Transactional(readOnly = true)
    public DocumentResponse getDocumentById(Long id) {
        Document document = documentRepository.findById(id).orElseThrow(() -> new EntityNotFoundException("Document not found"));
        return DocumentResponse.from(document);
    }

    private Map<String, Object> buildSafeSummaryMap(Document document, int maxChars) throws IOException {
        int clipped = Math.max(120, Math.min(maxChars, 2000));
        String summary = "";
        try {
            byte[] bytes = documentEncryptionService.readDecryptedDocumentContent(document);
            String extracted = textExtractionService.extractText(bytes, document.getFileType(), document.getFileName());
            String compact = extracted == null ? "" : extracted.replaceAll("\\s+", " ").trim();
            String redacted = redactSensitive(compact);
            summary = redacted.length() > clipped ? redacted.substring(0, clipped) + "..." : redacted;
        } catch (Exception e) {
            log.warn("Summary text extraction failed for document {}: {}", document.getId(), e.getMessage());
        }

        if (summary == null || summary.isBlank()) {
            summary = "Summary unavailable from document text. Use metadata-based review.";
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("documentId", document.getId());
        result.put("documentName", document.getName());
        result.put("classificationLevel", document.getClassificationLevel() != null ? document.getClassificationLevel().name() : null);
        result.put("department", document.getDepartment());
        result.put("generatedAt", LocalDateTime.now().toString());
        result.put("summary", summary);
        return result;
    }

    private String redactSensitive(String text) {
        if (text == null || text.isBlank()) return text;
        String out = text;
        out = Pattern.compile("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}").matcher(out).replaceAll("[REDACTED_EMAIL]");
        out = Pattern.compile("\\b\\d{3,4}[- ]?\\d{3,4}[- ]?\\d{3,4}\\b").matcher(out).replaceAll("[REDACTED_NUMBER]");
        return out;
    }
}
