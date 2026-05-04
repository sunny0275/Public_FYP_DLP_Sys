package com.dlp.platform.service.blockchain;

/**
 * Off-chain Storage Service using Google Cloud Storage.
 * 
 * This service provides:
 * - Document upload to GCS (off-chain storage)
 * - Document download from GCS
 * - Hash-based verification (content integrity)
 * - Automatic fallback to local storage when GCS is not configured
 * 
 * Architecture:
 * - Local: ./uploads/{year}/{month}/{dept}/{uuid}.pdf (existing)
 * - GCS: gs://{bucket}/documents/{year}/{month}/{uuid}.pdf (new)
 * 
 * Both stores the same content hash in the database for verification.
 */

import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageOptions;
import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.BlobInfo;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import java.util.Optional;

@Service
@Slf4j
public class CloudStorageService {

    @Value("${gcs.document-bucket:}")
    private String gcsBucket;

    @Value("${gcs.enabled:false}")
    private boolean gcsEnabled;

    private Storage storage;
    private boolean initialized = false;

    @PostConstruct
    public void init() {
        if (gcsEnabled && gcsBucket != null && !gcsBucket.isBlank()) {
            try {
                storage = StorageOptions.getDefaultInstance().getService();
                log.info("CloudStorageService initialized with GCS bucket: gs://{}", 
                    gcsBucket.replaceFirst("^gs://", ""));
                initialized = true;
            } catch (Exception e) {
                log.warn("Failed to initialize GCS client, falling back to local storage: {}", 
                    e.getMessage());
                initialized = false;
            }
        } else {
            log.info("CloudStorageService initialized in LOCAL mode (GCS not configured)");
        }
    }

    /**
     * Check if GCS is enabled and configured
     */
    public boolean isGcsEnabled() {
        return initialized && gcsEnabled;
    }

    /**
     * Get the configured bucket name
     */
    public Optional<String> getBucketName() {
        if (!initialized || gcsBucket == null || gcsBucket.isBlank()) {
            return Optional.empty();
        }
        return Optional.of(gcsBucket.replaceFirst("^gs://", "").trim());
    }

    /**
     * Upload document to GCS (off-chain storage).
     * 
     * @param content File content as byte array
     * @param department Department name for path organization
     * @param originalFilename Original filename for extension
     * @return GCS URI (gs://bucket/path) or empty if GCS not available
     */
    public Optional<String> uploadDocument(byte[] content, String department, String originalFilename) {
        if (!isGcsEnabled()) {
            log.debug("GCS not enabled, skipping cloud upload");
            return Optional.empty();
        }

        try {
            String bucket = getBucketName().orElse("");
            String path = generateStoragePath(department, originalFilename);
            
            BlobId blobId = BlobId.of(bucket, path);
            BlobInfo blobInfo = BlobInfo.newBuilder(blobId)
                .setContentType("application/pdf")
                .setMetadata(createMetadata(content.length))
                .build();
            
            storage.create(blobInfo, content);
            
            String gcsUri = "gs://" + bucket + "/" + path;
            log.info("Document uploaded to GCS: {} ({} bytes)", gcsUri, content.length);
            
            return Optional.of(gcsUri);
            
        } catch (Exception e) {
            log.error("Failed to upload document to GCS: {}", e.getMessage(), e);
            return Optional.empty();
        }
    }

    /**
     * Download document from GCS.
     * 
     * @param gcsUri Full GCS URI (gs://bucket/path)
     * @return Document content or empty if not found
     */
    public Optional<byte[]> downloadDocument(String gcsUri) {
        if (!isGcsEnabled()) {
            return Optional.empty();
        }

        try {
            String path = extractPathFromUri(gcsUri);
            String bucket = getBucketName().orElse("");
            
            BlobId blobId = BlobId.of(bucket, path);
            byte[] content = storage.readAllBytes(blobId);
            
            log.debug("Document downloaded from GCS: {}", gcsUri);
            return Optional.of(content);
            
        } catch (Exception e) {
            log.error("Failed to download document from GCS {}: {}", gcsUri, e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Delete document from GCS.
     * 
     * @param gcsUri Full GCS URI
     * @return true if deleted successfully
     */
    public boolean deleteDocument(String gcsUri) {
        if (!isGcsEnabled()) {
            return false;
        }

        try {
            String path = extractPathFromUri(gcsUri);
            String bucket = getBucketName().orElse("");
            
            BlobId blobId = BlobId.of(bucket, path);
            boolean deleted = storage.delete(blobId);
            
            if (deleted) {
                log.info("Document deleted from GCS: {}", gcsUri);
            }
            return deleted;
            
        } catch (Exception e) {
            log.error("Failed to delete document from GCS {}: {}", gcsUri, e.getMessage());
            return false;
        }
    }

    /**
     * Check if document exists in GCS.
     */
    public boolean documentExists(String gcsUri) {
        if (!isGcsEnabled()) {
            return false;
        }

        try {
            String path = extractPathFromUri(gcsUri);
            String bucket = getBucketName().orElse("");
            
            BlobId blobId = BlobId.of(bucket, path);
            return storage.get(blobId).exists();
            
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Generate storage path for GCS.
     * Format: documents/{year}/{month}/{department}/{uuid}.pdf
     */
    private String generateStoragePath(String department, String originalFilename) {
        String yearMonth = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy/MM"));
        String sanitizedDept = sanitize(department);
        String extension = getExtension(originalFilename);
        String uuid = java.util.UUID.randomUUID().toString();
        
        return String.format("documents/%s/%s/%s%s", yearMonth, sanitizedDept, uuid, extension);
    }

    private String extractPathFromUri(String gcsUri) {
        if (gcsUri == null || !gcsUri.startsWith("gs://")) {
            throw new IllegalArgumentException("Invalid GCS URI: " + gcsUri);
        }
        return gcsUri.substring(gcsUri.indexOf("/", 5) + 1);
    }

    private String sanitize(String input) {
        if (input == null || input.isBlank()) {
            return "unknown";
        }
        return input.replaceAll("[^a-zA-Z0-9-_]", "_");
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return ".pdf";
        }
        return filename.substring(filename.lastIndexOf(".")).toLowerCase();
    }

    private java.util.Map<String, String> createMetadata(int size) {
        java.util.Map<String, String> metadata = new java.util.HashMap<>();
        metadata.put("uploaded-at", LocalDateTime.now().toString());
        metadata.put("content-length", String.valueOf(size));
        return metadata;
    }

    /**
     * Calculate SHA-256 hash of content.
     */
    public String calculateHash(byte[] content) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(content);
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }
}
