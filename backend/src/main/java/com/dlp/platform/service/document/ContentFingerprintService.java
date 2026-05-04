package com.dlp.platform.service.document;

import com.dlp.platform.entity.User;
import lombok.extern.slf4j.Slf4j;
import org.apache.tika.Tika;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Random;

/**
 * Third Layer: Content Fingerprint and Honeytoken Service
 * 
 * Inserts invisible character combinations (honeytokens) into document text.
 * These fingerprints persist even when content is copied/pasted to new files.
 * DLP gateway can scan text streams to detect these fingerprints and trigger interception.
 * 
 * Implementation:
 * - Uses zero-width spaces, invisible Unicode characters, and special markers
 * - Inserts fingerprints at strategic locations (sentence boundaries, paragraph breaks)
 * - Fingerprints encode: user ID, document ID, timestamp hash
 * - Survives copy-paste operations
 */
@Service
@Slf4j
public class ContentFingerprintService {

    private static final String ZERO_WIDTH_SPACE = "\u200B"; // Zero-width space
    private static final String ZERO_WIDTH_NON_JOINER = "\u200C"; // Zero-width non-joiner
    private static final String ZERO_WIDTH_JOINER = "\u200D"; // Zero-width joiner
    private static final String LEFT_TO_RIGHT_MARK = "\u200E"; // Left-to-right mark
    private static final String RIGHT_TO_LEFT_MARK = "\u200F"; // Right-to-left mark
    
    private static final String FINGERPRINT_PREFIX = "DLP_FP_";
    private final Tika tika = new Tika();

    /**
     * Insert content fingerprints (honeytokens) into text content
     * 
     * @param content Original document content bytes
     * @param user User who uploaded/accessed the document
     * @param documentId Document ID
     * @return Content with embedded fingerprints
     */
    public byte[] insertContentFingerprints(byte[] content, User user, Long documentId) {
        log.debug("Inserting content fingerprints for user: {}, document: {}", 
            user != null ? user.getAccountId() : "UNKNOWN", documentId);

        try {
            // Detect content type
            String contentType = tika.detect(content);
            
            if (contentType != null && contentType.contains("text")) {
                // Text-based content (TXT, HTML, etc.)
                return insertFingerprintsInText(content, user, documentId);
            } else if (contentType != null && contentType.contains("pdf")) {
                // PDF - fingerprints would be inserted during PDF text extraction/rendering
                // For now, return original (would need PDF text layer manipulation)
                log.debug("PDF fingerprinting requires text layer manipulation - skipping");
                return content;
            } else {
                // Other formats - return original
                log.debug("Content type {} does not support fingerprinting", contentType);
                return content;
            }
        } catch (Exception e) {
            log.error("Failed to insert content fingerprints, returning original content", e);
            return content;
        }
    }

    /**
     * Insert fingerprints into text content using invisible Unicode characters
     */
    private byte[] insertFingerprintsInText(byte[] content, User user, Long documentId) {
        try {
            String text = new String(content, StandardCharsets.UTF_8);
            String fingerprint = buildFingerprint(user, documentId);
            
            // Insert fingerprints at sentence boundaries and paragraph breaks
            String fingerprinted = insertFingerprintsAtBoundaries(text, fingerprint);
            
            return fingerprinted.getBytes(StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.error("Failed to insert fingerprints in text", e);
            return content;
        }
    }

    /**
     * Build fingerprint string using invisible Unicode characters
     * Encodes: user ID + document ID + timestamp hash
     */
    private String buildFingerprint(User user, Long documentId) {
        try {
            String accountId = user != null && user.getAccountId() != null ? user.getAccountId() : "UNKNOWN";
            String payload = String.format("%s|%d|%d", accountId, documentId != null ? documentId : 0, 
                System.currentTimeMillis() / 1000);
            
            // Hash payload
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(payload.getBytes(StandardCharsets.UTF_8));
            String hashStr = Base64.getEncoder().encodeToString(hash).substring(0, 16);
            
            // Encode hash as invisible Unicode characters
            StringBuilder fingerprint = new StringBuilder();
            fingerprint.append(FINGERPRINT_PREFIX);
            
            for (char c : hashStr.toCharArray()) {
                int code = (int) c;
                // Map each character to a combination of invisible Unicode characters
                if (code % 2 == 0) {
                    fingerprint.append(ZERO_WIDTH_SPACE);
                } else {
                    fingerprint.append(ZERO_WIDTH_NON_JOINER);
                }
                if (code % 3 == 0) {
                    fingerprint.append(ZERO_WIDTH_JOINER);
                }
                if (code % 5 == 0) {
                    fingerprint.append(LEFT_TO_RIGHT_MARK);
                }
            }
            
            return fingerprint.toString();
        } catch (Exception e) {
            log.error("Failed to build fingerprint", e);
            return FINGERPRINT_PREFIX + "DEFAULT";
        }
    }

    /**
     * Insert fingerprints at text boundaries (sentence ends, paragraph breaks)
     */
    private String insertFingerprintsAtBoundaries(String text, String fingerprint) {
        StringBuilder result = new StringBuilder();
        String[] sentences = text.split("(?<=[.!?])\\s+");
        
        Random random = new Random(42); // Deterministic seed for reproducibility
        
        for (int i = 0; i < sentences.length; i++) {
            result.append(sentences[i]);
            
            // Insert fingerprint after every 3-5 sentences (randomized but deterministic)
            if (i > 0 && (i % (3 + random.nextInt(3)) == 0)) {
                result.append(fingerprint);
            }
            
            // Add space after sentence (except last)
            if (i < sentences.length - 1) {
                result.append(" ");
            }
        }
        
        // Also insert at paragraph breaks
        String[] paragraphs = result.toString().split("\\n\\s*\\n");
        result = new StringBuilder();
        
        for (int i = 0; i < paragraphs.length; i++) {
            result.append(paragraphs[i]);
            if (i < paragraphs.length - 1) {
                result.append("\n\n").append(fingerprint);
            }
        }
        
        return result.toString();
    }

    /**
     * Detect fingerprints in text content (for DLP gateway scanning)
     * 
     * @param content Text content to scan
     * @return List of detected fingerprints
     */
    public List<String> detectFingerprints(byte[] content) {
        List<String> fingerprints = new ArrayList<>();
        
        try {
            String text = new String(content, StandardCharsets.UTF_8);
            
            // Look for fingerprint prefix
            int index = 0;
            while ((index = text.indexOf(FINGERPRINT_PREFIX, index)) != -1) {
                // Extract fingerprint (up to next visible character or end)
                int end = index + FINGERPRINT_PREFIX.length();
                while (end < text.length() && isInvisibleChar(text.charAt(end))) {
                    end++;
                }
                
                String fingerprint = text.substring(index, end);
                fingerprints.add(fingerprint);
                index = end;
            }
        } catch (Exception e) {
            log.error("Failed to detect fingerprints", e);
        }
        
        return fingerprints;
    }

    /**
     * Check if character is invisible Unicode marker
     */
    private boolean isInvisibleChar(char c) {
        return c == ZERO_WIDTH_SPACE.charAt(0) ||
               c == ZERO_WIDTH_NON_JOINER.charAt(0) ||
               c == ZERO_WIDTH_JOINER.charAt(0) ||
               c == LEFT_TO_RIGHT_MARK.charAt(0) ||
               c == RIGHT_TO_LEFT_MARK.charAt(0);
    }
}
