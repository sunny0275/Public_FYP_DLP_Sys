package com.dlp.platform.service.document;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import jakarta.annotation.PostConstruct;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.Comparator;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
public class FileStorageService {

    @Value("${file.storage.location:./uploads}")
    private String storageLocation;

    @Value("${file.storage.max-size:524288000}") // 500MB default
    private Long maxFileSize;

    private Path uploadDirectory;

    private static final String[] ALLOWED_EXTENSIONS = {
        ".pdf"
    };

    // MIME type to extension mapping for validation
    private static final Map<String, String[]> MIME_TO_EXTENSIONS = Map.of(
        "application/pdf", new String[]{".pdf"}
    );

    @PostConstruct
    public void init() throws IOException {
        uploadDirectory = Paths.get(storageLocation).toAbsolutePath().normalize();
        Files.createDirectories(uploadDirectory);
        log.info("File storage initialized at: {}", uploadDirectory);
    }

    /**
     * Delete ALL stored files under the configured upload directory (keeps the root directory).
     * Intended for dev/test resets only.
     *
     * @return number of filesystem entries deleted (files + directories under root)
     */
    public int purgeAllFiles() throws IOException {
        if (uploadDirectory == null) {
            throw new IllegalStateException("Upload directory not initialized");
        }
        if (!Files.exists(uploadDirectory)) {
            return 0;
        }

        // Walk and delete children first, then directories (reverse order). Keep the root folder.
        try (var stream = Files.walk(uploadDirectory)) {
            var paths = stream
                .filter(p -> !p.equals(uploadDirectory))
                .sorted(Comparator.reverseOrder())
                .toList();

            int deleted = 0;
            for (Path p : paths) {
                try {
                    if (Files.deleteIfExists(p)) {
                        deleted++;
                    }
                } catch (IOException e) {
                    // Non-fatal: continue attempting to delete remaining entries
                    log.warn("Failed to delete path during purge: {} - {}", p, e.getMessage());
                }
            }

            log.warn("Purged upload directory contents: {} (deleted entries: {})", uploadDirectory, deleted);
            return deleted;
        }
    }

    /**
     * Store uploaded file and return the file path
     * SECURITY: Validates path traversal, file type, and MIME type
     */
    public String storeFile(MultipartFile file, String department) throws IOException {
        validateFile(file);

        // Create directory structure: uploads/{year}/{month}/{department}/
        String yearMonth = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy/MM"));
        String sanitizedDept = sanitize(department);

        Path directory = uploadDirectory
            .resolve(yearMonth)
            .resolve(sanitizedDept)
            .normalize();

        // SECURITY: Ensure directory is within upload directory
        if (!directory.startsWith(uploadDirectory)) {
            throw new SecurityException("Invalid directory path");
        }

        Files.createDirectories(directory);

        // Generate unique filename with validated extension
        String extension = getValidatedExtension(file);
        String uniqueFilename = UUID.randomUUID().toString() + extension;
        Path targetPath = directory.resolve(uniqueFilename).normalize();

        // SECURITY: Final check that target is within upload directory
        if (!targetPath.startsWith(uploadDirectory)) {
            throw new SecurityException("Invalid file path");
        }

        // Store file
        try (InputStream inputStream = file.getInputStream()) {
            Files.copy(inputStream, targetPath, StandardCopyOption.REPLACE_EXISTING);
        }

        log.info("File stored successfully: {}", targetPath);
        return targetPath.toString();
    }

    /**
     * Store file chunk for large file uploads
     * SECURITY: Validates uploadId to prevent path traversal
     */
    public String storeChunk(MultipartFile chunk, String uploadId, int chunkNumber) throws IOException {
        // SECURITY: Validate uploadId is UUID format
        try {
            UUID.fromString(uploadId);
        } catch (IllegalArgumentException e) {
            throw new SecurityException("Invalid upload ID format");
        }

        Path chunkDirectory = uploadDirectory
            .resolve("chunks")
            .resolve(uploadId)
            .normalize();

        // SECURITY: Ensure within upload directory
        if (!chunkDirectory.startsWith(uploadDirectory)) {
            throw new SecurityException("Invalid chunk directory path");
        }

        Files.createDirectories(chunkDirectory);

        Path chunkPath = chunkDirectory.resolve(String.format("chunk_%d", chunkNumber)).normalize();

        // SECURITY: Final validation
        if (!chunkPath.startsWith(uploadDirectory)) {
            throw new SecurityException("Invalid chunk path");
        }

        try (InputStream inputStream = chunk.getInputStream()) {
            Files.copy(inputStream, chunkPath, StandardCopyOption.REPLACE_EXISTING);
        }

        return chunkPath.toString();
    }

    /**
     * Merge file chunks into single file
     */
    public String mergeChunks(String uploadId, String originalFilename, String department, int totalChunks)
            throws IOException {
        // Validate uploadId
        try {
            UUID.fromString(uploadId);
        } catch (IllegalArgumentException e) {
            throw new SecurityException("Invalid upload ID format");
        }

        Path chunkDirectory = uploadDirectory.resolve("chunks").resolve(uploadId).normalize();

        if (!chunkDirectory.startsWith(uploadDirectory) || !Files.exists(chunkDirectory)) {
            throw new SecurityException("Invalid chunk directory");
        }

        // Create final file path
        String yearMonth = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy/MM"));
        Path directory = uploadDirectory
            .resolve(yearMonth)
            .resolve(sanitize(department))
            .normalize();

        if (!directory.startsWith(uploadDirectory)) {
            throw new SecurityException("Invalid directory path");
        }

        Files.createDirectories(directory);

        String extension = getValidatedExtensionFromFilename(originalFilename);
        String uniqueFilename = UUID.randomUUID().toString() + extension;
        Path targetPath = directory.resolve(uniqueFilename).normalize();

        if (!targetPath.startsWith(uploadDirectory)) {
            throw new SecurityException("Invalid target path");
        }

        // Merge chunks
        try (FileOutputStream fos = new FileOutputStream(targetPath.toFile())) {
            for (int i = 0; i < totalChunks; i++) {
                Path chunkPath = chunkDirectory.resolve(String.format("chunk_%d", i));
                Files.copy(chunkPath, fos);
            }
        }

        // Clean up chunks
        deleteDirectory(chunkDirectory.toFile());

        log.info("Chunks merged successfully: {}", targetPath);
        return targetPath.toString();
    }

    /**
     * Read file as byte array
     * SECURITY: Validates file path is within upload directory
     */
    /**
     * Store file from byte array (for version restoration)
     */
    public String storeFileFromBytes(byte[] fileContent, String department, String originalFilename) throws IOException {
        // Create directory structure: uploads/{year}/{month}/{department}/
        String yearMonth = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy/MM"));
        String sanitizedDept = sanitize(department);

        Path directory = uploadDirectory
            .resolve(yearMonth)
            .resolve(sanitizedDept)
            .normalize();

        // SECURITY: Ensure directory is within upload directory
        if (!directory.startsWith(uploadDirectory)) {
            throw new SecurityException("Invalid directory path");
        }

        Files.createDirectories(directory);

        // Generate unique filename
        String extension = originalFilename.contains(".") 
            ? originalFilename.substring(originalFilename.lastIndexOf("."))
            : "";
        String uniqueFilename = UUID.randomUUID().toString() + extension;
        Path targetPath = directory.resolve(uniqueFilename).normalize();

        // SECURITY: Final check that target is within upload directory
        if (!targetPath.startsWith(uploadDirectory)) {
            throw new SecurityException("Invalid file path");
        }

        // Store file
        Files.write(targetPath, fileContent, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);

        log.info("File stored from bytes successfully: {}", targetPath);
        return targetPath.toString();
    }

    public byte[] readFile(String filePath) throws IOException {
        Path path = Paths.get(filePath);
        if (!path.isAbsolute()) {
            path = uploadDirectory.resolve(path);
        }
        path = path.normalize().toAbsolutePath();

        // SECURITY: Ensure file is within upload directory
        if (!path.startsWith(uploadDirectory)) {
            log.error("Attempted to read file outside upload directory: {} (resolved: {})", filePath, path);
            throw new SecurityException("Access denied: File path outside upload directory");
        }

        if (!Files.exists(path)) {
            Path fallbackPath = resolveFallbackPathUnderUploads(filePath);
            if (fallbackPath != null && Files.exists(fallbackPath)) {
                log.warn("Original file path {} not found, falling back to {}", filePath, fallbackPath);
                path = fallbackPath;
            } else {
                log.error("File not found: {} (resolved path: {}, upload directory: {})", filePath, path, uploadDirectory);
                throw new IOException(String.format("File not found: %s (resolved path: %s)", filePath, path));
            }
        }

        if (!Files.isRegularFile(path)) {
            log.error("Path is not a regular file: {} (resolved: {})", filePath, path);
            throw new IOException("Path is not a regular file: " + path);
        }

        return Files.readAllBytes(path);
    }

    private Path resolveFallbackPathUnderUploads(String filePath) {
        String normalized = filePath.replace('\\', '/');
        int uploadsIndex = normalized.indexOf("/uploads");
        if (uploadsIndex < 0) {
            return null;
        }

        int start = uploadsIndex + "/uploads".length();
        while (start < normalized.length() && normalized.charAt(start) == '/') {
            start++;
        }

        if (start >= normalized.length()) {
            return uploadDirectory;
        }

        String relative = normalized.substring(start);
        Path fallback = uploadDirectory.resolve(relative).normalize();
        if (!fallback.startsWith(uploadDirectory)) {
            return null;
        }
        return fallback;
    }

    /**
     * Delete file
     * SECURITY: Validates file path is within upload directory
     */
    public void deleteFile(String filePath) throws IOException {
        Path path = Paths.get(filePath).normalize().toAbsolutePath();

        // SECURITY: Ensure file is within upload directory
        if (!path.startsWith(uploadDirectory)) {
            log.error("Attempted to delete file outside upload directory: {}", filePath);
            throw new SecurityException("Access denied: File path outside upload directory");
        }

        if (Files.exists(path)) {
            Files.delete(path);
            log.info("File deleted: {}", path);
        }
    }

    /**
     * Calculate SHA-256 hash of file using streaming to avoid memory issues
     * SECURITY: Uses streaming instead of loading entire file into memory
     */
    public String calculateFileHash(String filePath) throws IOException, NoSuchAlgorithmException {
        Path path = Paths.get(filePath).normalize().toAbsolutePath();

        // SECURITY: Ensure file is within upload directory
        if (!path.startsWith(uploadDirectory)) {
            throw new SecurityException("Access denied: File path outside upload directory");
        }

        MessageDigest digest = MessageDigest.getInstance("SHA-256");

        // Stream the file to avoid loading entire file into memory
        try (InputStream fis = Files.newInputStream(path)) {
            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = fis.read(buffer)) != -1) {
                digest.update(buffer, 0, bytesRead);
            }
        }

        byte[] hashBytes = digest.digest();
        return HexFormat.of().formatHex(hashBytes);
    }

    /**
     * Calculate SHA-256 hash of MultipartFile using streaming
     */
    public String calculateFileHash(MultipartFile file) throws IOException, NoSuchAlgorithmException {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");

        try (InputStream is = file.getInputStream()) {
            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = is.read(buffer)) != -1) {
                digest.update(buffer, 0, bytesRead);
            }
        }

        byte[] hashBytes = digest.digest();
        return HexFormat.of().formatHex(hashBytes);
    }

    /**
     * Validate file before upload
     * SECURITY: Validates size, extension, MIME type, and file signature
     */
    private void validateFile(MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Cannot upload empty file");
        }

        if (file.getSize() > maxFileSize) {
            throw new IllegalArgumentException(
                String.format("File size exceeds maximum allowed size: %d bytes", maxFileSize)
            );
        }

        String filename = file.getOriginalFilename();
        if (filename == null || filename.trim().isEmpty()) {
            throw new IllegalArgumentException("Invalid filename");
        }

        // Check extension
        String extension = getValidatedExtensionFromFilename(filename);

        // SECURITY: Validate actual content type (MIME type)
        String contentType = file.getContentType();
        if (!isValidContentType(contentType, extension)) {
            throw new IllegalArgumentException(
                "File content type does not match extension. Possible file type spoofing."
            );
        }

        // SECURITY: Validate file magic bytes (file signature)
        byte[] header = new byte[12];
        try (InputStream is = file.getInputStream()) {
            int bytesRead = is.read(header);
            if (bytesRead > 0 && !isValidFileSignature(header, extension)) {
                throw new IllegalArgumentException("Invalid file signature for extension " + extension);
            }
        }
    }

    /**
     * Get validated file extension
     * SECURITY: Removes path separators and validates against whitelist
     */
    private String getValidatedExtension(MultipartFile file) {
        String filename = file.getOriginalFilename();
        return getValidatedExtensionFromFilename(filename);
    }

    /**
     * Get validated extension from filename
     * SECURITY: Sanitizes filename and validates extension
     */
    private String getValidatedExtensionFromFilename(String filename) {
        if (filename == null) {
            throw new IllegalArgumentException("Filename is null");
        }

        // SECURITY: Remove any path separators
        filename = filename.replaceAll("[/\\\\]", "");

        int lastDot = filename.lastIndexOf('.');
        if (lastDot == -1) {
            throw new IllegalArgumentException("File has no extension");
        }

        String extension = filename.substring(lastDot).toLowerCase();

        // SECURITY: Validate extension is in whitelist
        boolean isAllowed = Arrays.asList(ALLOWED_EXTENSIONS).contains(extension);

        if (!isAllowed) {
            throw new IllegalArgumentException(
                String.format("File type not allowed: %s", extension)
            );
        }

        return extension;
    }

    /**
     * Validate content type matches extension
     * SECURITY: Prevents MIME type spoofing
     */
    private boolean isValidContentType(String contentType, String extension) {
        if (contentType == null) {
            return false;
        }

        // Check if MIME type maps to this extension
        String[] validExtensions = MIME_TO_EXTENSIONS.get(contentType);
        if (validExtensions != null) {
            return Arrays.asList(validExtensions).contains(extension);
        }

        // For types not in our map, allow but log
        log.warn("Unrecognized content type: {} for extension: {}", contentType, extension);
        return true;
    }

    /**
     * Validate file signature (magic bytes)
     * SECURITY: Checks actual file content matches claimed type
     */
    private boolean isValidFileSignature(byte[] header, String extension) {
        if (header == null || header.length < 4) {
            return false;
        }

        switch (extension) {
            case ".pdf":
                // %PDF
                return header[0] == 0x25 && header[1] == 0x50 &&
                       header[2] == 0x44 && header[3] == 0x46;

            default:
                log.warn("No signature validation for extension: {}", extension);
                return true;
        }
    }

    /**
     * Sanitize string for use in file path
     * SECURITY: Removes all special characters except alphanumeric, hyphen, underscore
     */
    private String sanitize(String input) {
        if (input == null) {
            return "unknown";
        }
        return input.replaceAll("[^a-zA-Z0-9-_]", "_");
    }

    /**
     * Delete directory recursively
     */
    private void deleteDirectory(File directory) {
        if (directory.exists()) {
            File[] files = directory.listFiles();
            if (files != null) {
                for (File file : files) {
                    if (file.isDirectory()) {
                        deleteDirectory(file);
                    } else {
                        file.delete();
                    }
                }
            }
            directory.delete();
        }
    }

    /**
     * Get file size
     * SECURITY: Validates path is within upload directory
     */
    public long getFileSize(String filePath) throws IOException {
        Path path = Paths.get(filePath).normalize().toAbsolutePath();

        if (!path.startsWith(uploadDirectory)) {
            throw new SecurityException("Access denied: File path outside upload directory");
        }

        if (!Files.exists(path)) {
            throw new IOException("File not found");
        }
        return Files.size(path);
    }

    /**
     * Check if file exists
     * SECURITY: Validates path is within upload directory
     */
    public boolean fileExists(String filePath) {
        try {
            Path path = Paths.get(filePath).normalize().toAbsolutePath();

            if (!path.startsWith(uploadDirectory)) {
                return false;
            }

            return Files.exists(path);
        } catch (Exception e) {
            return false;
        }
    }
}
