package com.dlp.platform.service.document;

import com.dlp.platform.entity.User;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentInformation;
import org.apache.pdfbox.Loader;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

/**
 * Third Layer: Metadata and GUID Watermarking Service
 * 
 * Embeds unique GUIDs and encrypted tags into:
 * - PDF document metadata (author, subject, keywords, custom properties)
 * - Office file attributes (requires Apache POI for Word/Excel)
 * - File structure markers
 * 
 * These markers persist even if content is copied to new files, enabling DLP gateway detection.
 */
@Service
@Slf4j
public class MetadataWatermarkService {

    private static final String METADATA_PREFIX = "DLP_";
    private static final String WATERMARK_BRAND = "DLP Platform";
    private static final String GUID_KEY = "DLP_GUID";
    private static final String USER_ID_KEY = "DLP_USER_ID";
    private static final String TIMESTAMP_KEY = "DLP_TIMESTAMP";
    private static final String DOCUMENT_ID_KEY = "DLP_DOCUMENT_ID";

    /**
     * Embed metadata watermark into PDF
     * 
     * @param pdfContent Original PDF bytes
     * @param user User who uploaded/accessed the document
     * @param documentId Document ID
     * @return PDF with embedded metadata
     */
    public byte[] embedMetadataWatermark(byte[] pdfContent, User user, Long documentId) throws IOException {
        log.debug("Embedding metadata watermark for user: {}, document: {}", 
            user != null ? user.getAccountId() : "UNKNOWN", documentId);

        try (PDDocument document = Loader.loadPDF(pdfContent);
             ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {

            PDDocumentInformation info = document.getDocumentInformation();
            
            // Generate unique GUID for this document instance
            String guid = UUID.randomUUID().toString();
            
            // Embed metadata
            info.setAuthor(METADATA_PREFIX + (user != null ? user.getAccountId() : "UNKNOWN"));
            info.setSubject(METADATA_PREFIX + WATERMARK_BRAND + "_PROTECTED");
            info.setKeywords(buildKeywords(user, documentId, guid));
            info.setCreator(METADATA_PREFIX + "FYP-DLP-System");
            info.setProducer(METADATA_PREFIX + "DLP-Platform-v1.0");
            
            // Set custom properties (PDF metadata)
            info.setCustomMetadataValue(GUID_KEY, guid);
            info.setCustomMetadataValue(USER_ID_KEY, user != null && user.getAccountId() != null 
                ? user.getAccountId() : "UNKNOWN");
            info.setCustomMetadataValue(TIMESTAMP_KEY, LocalDateTime.now()
                .format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
            info.setCustomMetadataValue(DOCUMENT_ID_KEY, documentId != null ? documentId.toString() : "UNKNOWN");
            
            // Set title with embedded marker
            String originalTitle = info.getTitle();
            if (originalTitle == null || originalTitle.isEmpty()) {
                info.setTitle(METADATA_PREFIX + "DOCUMENT_" + documentId);
            } else {
                info.setTitle(originalTitle + " " + METADATA_PREFIX + guid.substring(0, 8));
            }

            document.setDocumentInformation(info);
            document.save(outputStream);

            log.info("Metadata watermark embedded successfully: GUID={}, User={}", guid, 
                user != null ? user.getAccountId() : "UNKNOWN");
            return outputStream.toByteArray();
        } catch (Exception e) {
            log.error("Failed to embed metadata watermark, returning original content", e);
            return pdfContent;
        }
    }

    /**
     * Extract metadata watermark from PDF
     * 
     * @param pdfContent PDF bytes
     * @return Extracted metadata or null
     */
    public DocumentMetadata extractMetadataWatermark(byte[] pdfContent) {
        try (PDDocument document = Loader.loadPDF(pdfContent)) {
            PDDocumentInformation info = document.getDocumentInformation();
            
            String guid = info.getCustomMetadataValue(GUID_KEY);
            String userId = info.getCustomMetadataValue(USER_ID_KEY);
            String timestamp = info.getCustomMetadataValue(TIMESTAMP_KEY);
            String documentId = info.getCustomMetadataValue(DOCUMENT_ID_KEY);
            
            if (guid != null || userId != null) {
                return new DocumentMetadata(guid, userId, timestamp, documentId);
            }
            
            return null;
        } catch (Exception e) {
            log.error("Failed to extract metadata watermark", e);
            return null;
        }
    }

    /**
     * Build keywords string with embedded markers
     */
    private String buildKeywords(User user, Long documentId, String guid) {
        StringBuilder keywords = new StringBuilder();
        keywords.append(METADATA_PREFIX);
        keywords.append("USER:").append(user != null ? user.getAccountId() : "UNKNOWN");
        keywords.append("|DOC:").append(documentId != null ? documentId : "UNKNOWN");
        keywords.append("|GUID:").append(guid);
        keywords.append("|TS:").append(LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        return keywords.toString();
    }

    /**
     * Check if PDF contains DLP metadata markers
     */
    public boolean hasDLPMetadata(byte[] pdfContent) {
        try (PDDocument document = Loader.loadPDF(pdfContent)) {
            PDDocumentInformation info = document.getDocumentInformation();
            
            // Check for DLP markers in various metadata fields
            String author = info.getAuthor();
            String subject = info.getSubject();
            String keywords = info.getKeywords();
            String guid = info.getCustomMetadataValue(GUID_KEY);
            
            return (author != null && author.startsWith(METADATA_PREFIX)) ||
                   (subject != null && subject.startsWith(METADATA_PREFIX)) ||
                   (keywords != null && keywords.contains(METADATA_PREFIX)) ||
                   (guid != null && !guid.isEmpty());
        } catch (Exception e) {
            log.error("Failed to check DLP metadata", e);
            return false;
        }
    }

    /**
     * Metadata extraction result
     */
    public static class DocumentMetadata {
        private final String guid;
        private final String userId;
        private final String timestamp;
        private final String documentId;

        public DocumentMetadata(String guid, String userId, String timestamp, String documentId) {
            this.guid = guid;
            this.userId = userId;
            this.timestamp = timestamp;
            this.documentId = documentId;
        }

        public String getGuid() { return guid; }
        public String getUserId() { return userId; }
        public String getTimestamp() { return timestamp; }
        public String getDocumentId() { return documentId; }
    }
}
