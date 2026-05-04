package com.dlp.platform.service.document;

import com.dlp.platform.entity.User;
import com.dlp.platform.entity.WatermarkFingerprint;
import com.dlp.platform.repository.WatermarkFingerprintRepository;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Service for applying watermarks to documents for DLP compliance
 *
 * Features:
 * - PDF watermarking using Apache PDFBox
 * - Diagonal watermark overlay with user information
 * - Customizable watermark text, color, opacity
 * - Multi-page watermark application
 * - Watermark includes: accountId, timestamp, IP address, encrypted fingerprint
 */
@Service
@Slf4j
public class WatermarkService {

    private static final float A4_WIDTH_PT = 595f;
    private static final float A4_HEIGHT_PT = 842f;
    private static final float WATERMARK_OPACITY = 0.40f;
    private static final Color WATERMARK_COLOR = new Color(85, 85, 85);
    private static final float WATERMARK_BASE_FONT_SIZE_PT = 8f;
    /** Diagonal grid base step (pt, scaled). Actual step also uses font metrics to avoid overlap. */
    private static final float WATERMARK_BASE_COL_STEP_PT = 80f;
    private static final float WATERMARK_BASE_ROW_STEP_PT = 50f;
    private static final float WATERMARK_STAGGER_RATIO = 0.62f;
    private static final float WATERMARK_ROTATION_DEGREES = 45f; // right-top -> left-bottom
    private static final float FOOTER_OPACITY = 0.90f;
    private static final Color FOOTER_BACKGROUND_COLOR = new Color(255, 255, 255, 210);
    /** Character set for generating encoded short code. */
    private static final String SHORT_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    /** Length of generated short code. */
    private static final int SHORT_CODE_LENGTH = 7;

    private final WatermarkFingerprintRepository watermarkFingerprintRepository;
    /** Per-process counter to ensure uniqueness when hashing concurrently. */
    private final AtomicLong fingerprintCounter = new AtomicLong(System.currentTimeMillis() % 1000000);

    @Value("${dlp.document.watermark-fingerprint-prefix:DLP}")
    private String fingerprintPrefix;

    public WatermarkService(WatermarkFingerprintRepository watermarkFingerprintRepository) {
        this.watermarkFingerprintRepository = watermarkFingerprintRepository;
    }

    /**
     * Watermark operation result — contains the watermarked content and the short code
     * used, so the caller (and frontend footer) can display a consistent fingerprint.
     */
    @Getter
    public static class WatermarkResult {
        private final byte[] content;
        private final String shortCode;
        private final String appliedIp;

        public WatermarkResult(byte[] content, String shortCode, String appliedIp) {
            this.content = content;
            this.shortCode = shortCode;
            this.appliedIp = appliedIp;
        }
    }

    /**
     * Apply watermark to PDF document for on-screen viewing.
     *
     * @param pdfContent Original PDF content
     * @param user User viewing the document
     * @param ipAddress IP address of viewer
     * @param documentId Document ID
     * @return Watermarked PDF content
     * @throws IOException If PDF processing fails
     */
    public byte[] applyWatermarkToPDF(byte[] pdfContent, User user, String ipAddress, Long documentId)
            throws IOException {
        String accountId = user != null && user.getAccountId() != null ? user.getAccountId() : "UNKNOWN";
        log.debug("Applying watermark to PDF for user: {}", accountId);

        try (PDDocument document = loadPdfDocument(pdfContent);
             ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {

            // Build watermark text
            String watermarkText = buildWatermarkText(user, ipAddress, documentId);
            String footerText = buildFooterText(user, ipAddress, documentId);

            // Apply watermark to each page
            for (PDPage page : document.getPages()) {
                applyWatermarkToPage(document, page, watermarkText, footerText);
            }

            // Save watermarked document
            document.save(outputStream);

            log.info("Watermark applied successfully: {} pages processed", document.getNumberOfPages());
            return outputStream.toByteArray();
        }
    }

    /**
     * Apply watermark AND encrypt PDF for download.
     * <p>
     * - Watermark payload follows normal internal pattern (userId + timestamp + docId)
     * - PDF is then protected with a user password derived from the user's accountId
     *   so that only the intended user can open it.
     */
    public byte[] applyWatermarkAndEncryptPdfForDownload(byte[] pdfContent, User user, Long documentId)
            throws IOException {
        // First apply the standard internal watermark (no IP needed for download)
        byte[] watermarked = applyWatermarkToPDF(pdfContent, user, "download", documentId);

        // Then load again and apply password protection
        try (PDDocument document = loadPdfDocument(watermarked);
             ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {

            // Build user password from account ID (login ID)
            String userPassword = user.getAccountId();
            if (userPassword == null || userPassword.isBlank()) {
                // Fallback to full name or email if accountId is somehow missing
                userPassword = user.getEmail() != null ? user.getEmail() : "user";
            }

            // Owner password can be a random or system-level secret; for now use a fixed strong value
            String ownerPassword = "DLP_OWNER_PROTECT";

            org.apache.pdfbox.pdmodel.encryption.AccessPermission accessPermission =
                new org.apache.pdfbox.pdmodel.encryption.AccessPermission();
            // Keep default permissions (can be tightened later if needed)

            org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy spp =
                new org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy(
                    ownerPassword, userPassword, accessPermission);
            spp.setEncryptionKeyLength(128);
            spp.setPreferAES(true);

            document.protect(spp);
            document.save(outputStream);

            log.info("PDF encrypted for download for user: {} (documentId: {})", user.getAccountId(), documentId);
            return outputStream.toByteArray();
        } catch (Exception e) {
            log.error("Failed to encrypt PDF for download, falling back to watermarked-only PDF", e);
            // In case of encryption failure, return just the watermarked version to avoid blocking access
            return watermarked;
        }
    }

    /**
     * Apply watermark to a single PDF page
     * Watermarks are embedded directly into PDF content with fixed positions
     * to prevent removal and ensure visibility even when screenshots are taken
     */
    private void applyWatermarkToPage(PDDocument document, PDPage page, String watermarkText, String footerText)
            throws IOException {

        // Get page dimensions (fixed coordinates in PDF space)
        float pageWidth = page.getMediaBox().getWidth();
        float pageHeight = page.getMediaBox().getHeight();

        PDImageXObject overlayImage = buildPdfWatermarkOverlay(document, pageWidth, pageHeight, watermarkText, footerText);

        // Create content stream for overlay
        try (PDPageContentStream contentStream = new PDPageContentStream(
                document, page, PDPageContentStream.AppendMode.APPEND, true, true)) {
            contentStream.drawImage(overlayImage, 0, 0, pageWidth, pageHeight);
        }
    }

    private PDImageXObject buildPdfWatermarkOverlay(PDDocument document, float pageWidth, float pageHeight,
                                                    String watermarkText, String footerText) throws IOException {
        int canvasWidth = Math.max(1, Math.round(pageWidth));
        int canvasHeight = Math.max(1, Math.round(pageHeight));
        BufferedImage overlay = new BufferedImage(canvasWidth, canvasHeight, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g2d = overlay.createGraphics();
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

        // Draw diagonal watermark as rasterized text so PDF text extraction cannot read it.
        g2d.setColor(WATERMARK_COLOR);
        g2d.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, WATERMARK_OPACITY));
        g2d.setFont(buildImageWatermarkFont(canvasWidth, canvasHeight));
        drawDiagonalTextOnImage(g2d, canvasWidth, canvasHeight, watermarkText);

        // Draw footer as rasterized text as well.
        g2d.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, FOOTER_OPACITY));
        g2d.setColor(Color.DARK_GRAY);
        g2d.setFont(new Font("Arial", Font.BOLD, Math.max(11, Math.round(9f * computeA4Scale(pageWidth, pageHeight)))));
        FontMetrics fm = g2d.getFontMetrics();
        int footerWidth = fm.stringWidth(footerText);
        int fx = Math.max(12, canvasWidth - footerWidth - 16);
        int fy = Math.max(18, canvasHeight - 16);
        int padX = 8;
        int padY = 4;
        int bgX = Math.max(0, fx - padX);
        int bgY = Math.max(0, fy - fm.getAscent() - padY);
        int bgW = Math.min(canvasWidth - bgX, footerWidth + padX * 2);
        int bgH = Math.min(canvasHeight - bgY, fm.getHeight() + padY * 2);
        // Draw a solid backdrop first to fully mask any previous footer text.
        g2d.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 1.0f));
        g2d.setColor(FOOTER_BACKGROUND_COLOR);
        g2d.fillRoundRect(bgX, bgY, bgW, bgH, 8, 8);
        g2d.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, FOOTER_OPACITY));
        g2d.setColor(Color.DARK_GRAY);
        g2d.drawString(footerText, fx, fy);
        g2d.dispose();

        return LosslessFactory.createFromImage(document, overlay);
    }

    /**
     * Build diagonal watermark text: UID: {accountId} | {timestamp} | {ip} | {fingerPrint}
     */
    private String buildWatermarkText(User user, String ipAddress, Long documentId) {
        String accountId = user != null && user.getAccountId() != null ? user.getAccountId() : "UNKNOWN";
        String startTime = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        String ip = ipAddress != null ? ipAddress : "N/A";

        String fingerPrint = resolveFingerprintForDocument(documentId, user);
        return String.format("UID: %s | %s | %s | #%s", accountId, startTime, ip, fingerPrint);
    }

    /**
     * Generates a NEW fingerprint short code for EACH view.
     * Different views by the same user will have DIFFERENT fingerprints,
     * enabling traceability to the exact viewing session.
     * Fingerprint includes: userAccountId + userEmail + userName + timestamp (nanoseconds)
     */
    private String resolveFingerprintForDocument(Long documentId, User user) {
        if (documentId == null) {
            return "#N/A";
        }

        String userAccountId = user != null && user.getAccountId() != null ? user.getAccountId() : null;
        Long userId = user != null ? user.getId() : null;

        // Build unique identifier for this user
        String userIdentifier = userAccountId != null ? userAccountId :
                               (user != null && user.getEmail() != null ? user.getEmail() :
                               (user != null && user.getFullName() != null ? user.getFullName() : "UNKNOWN"));

        // Generate NEW short code for each view (includes timestamp for uniqueness)
        String shortCode = generateShortCodeWithUserInfo(documentId, user);
        String canonicalPayload = fingerprintPrefix + ":" + documentId + ":" + userIdentifier + ":" + shortCode;

        // Save to DB for future traceback lookup
        saveFingerprintIfAbsent(shortCode, canonicalPayload, documentId, user);

        log.debug("Generated new fingerprint for documentId={}, user={}: #{}", documentId, userIdentifier, shortCode);
        return shortCode;
    }

    /**
     * Generate a compact encoded short code (e.g. #VEAE3X2) from documentId + entropy.
     * Uses SHA-256 of a composite input, then Base32-like encoding for readability.
     */
    private String generateShortCode(Long documentId) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            String input = documentId + ":" + fingerprintCounter.incrementAndGet() + ":" + System.nanoTime();
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            // Use first 5 bytes → enough entropy for 25-bit code space
            return encodeToBase32(hash, 5);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 always available; fallback to simple counter-based code
            long id = (documentId * 7919 + fingerprintCounter.incrementAndGet()) % (1L << 25);
            return encodeBase32Fallback(id);
        }
    }

    /**
     * Generate a UNIQUE short code for each user + document combination.
     * Includes user info in the hash input to ensure different users get different codes.
     * Fingerprint format: userAccountId + userEmail + userName + timestamp
     */
    private String generateShortCodeWithUserInfo(Long documentId, User user) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");

            // Build unique user identifier from multiple fields
            String userAccountId = user != null && user.getAccountId() != null ? user.getAccountId() : "";
            String userEmail = user != null && user.getEmail() != null ? user.getEmail() : "";
            String userName = user != null && user.getFullName() != null ? user.getFullName() : "";
            String timestamp = String.valueOf(System.currentTimeMillis());

            // Combine all user info for uniqueness
            String combinedUserInfo = userAccountId + "|" + userEmail + "|" + userName + "|" + timestamp;

            // Include user info + documentId + entropy in hash
            String input = documentId + ":" + fingerprintCounter.incrementAndGet() + ":" + combinedUserInfo;
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));

            // Use first 6 bytes for more uniqueness (30 bits → longer code)
            return encodeToBase32(hash, 6);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 always available; fallback
            String userId = user != null && user.getAccountId() != null ? user.getAccountId() : "UNKNOWN";
            long id = (documentId * 7919 + userId.hashCode() + fingerprintCounter.incrementAndGet()) % (1L << 30);
            return encodeBase32Fallback(id);
        }
    }

    /** Base32-like encoder using the SHORT_CODE_CHARS alphabet. */
    private String encodeToBase32(byte[] hash, int bytesUsed) {
        StringBuilder sb = new StringBuilder();
        int buffer = 0;
        int bitsInBuffer = 0;
        for (int i = 0; i < bytesUsed; i++) {
            buffer = (buffer << 8) | (hash[i] & 0xFF);
            bitsInBuffer += 8;
            while (bitsInBuffer >= 5) {
                bitsInBuffer -= 5;
                int index = (buffer >> bitsInBuffer) & 0x1F;
                sb.append(SHORT_CODE_CHARS.charAt(index));
            }
        }
        // Pad if necessary, then trim to SHORT_CODE_LENGTH
        while (sb.length() < SHORT_CODE_LENGTH) {
            sb.append(SHORT_CODE_CHARS.charAt(buffer & 0x1F));
        }
        return sb.substring(0, SHORT_CODE_LENGTH);
    }

    /** Fallback encoder when SHA-256 is unavailable. */
    private String encodeBase32Fallback(long value) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < SHORT_CODE_LENGTH; i++) {
            sb.append(SHORT_CODE_CHARS.charAt((int) (value & 0x1F)));
            value >>>= 5;
        }
        return sb.reverse().toString();
    }

    /**
     * Persist the fingerprint record unless a record with the same shortCode or payload already exists.
     * Silently skips on collision (unique constraint), so concurrent inserts are safe.
     */
    private void saveFingerprintIfAbsent(String shortCode, String canonicalPayload, Long documentId, User user) {
        try {
            if (watermarkFingerprintRepository.findByShortCode(shortCode).isPresent()) {
                return;
            }
            if (watermarkFingerprintRepository.findByPayloadHash(canonicalPayload).isPresent()) {
                return;
            }
            Long userId = user != null ? user.getId() : null;
            WatermarkFingerprint fp = WatermarkFingerprint.builder()
                    .shortCode(shortCode)
                    .payloadHash(canonicalPayload)
                    .documentId(documentId)
                    .userId(userId)
                    .build();
            watermarkFingerprintRepository.save(fp);
            log.info("Persisted watermark fingerprint: shortCode={}, documentId={}, userId={}", shortCode, documentId, userId);
        } catch (Exception e) {
            log.warn("Failed to persist watermark fingerprint for documentId={}: {}", documentId, e.getMessage());
        }
    }

    /**
     * Build footer watermark text: UID: {accountId} | {timestamp} | {ip} | {fingerPrint}
     */
    private String buildFooterText(User user, String ipAddress, Long documentId) {
        String accountId = user != null && user.getAccountId() != null ? user.getAccountId() : "UNKNOWN";
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        String fingerPrint = resolveFingerprintForDocument(documentId, user); // Generates new fingerprint per view
        String ip = ipAddress != null ? ipAddress : "N/A";
        return String.format("UID: %s | %s | %s | #%s", accountId, timestamp, ip, fingerPrint);
    }

    /**
     * Build footer watermark text for external/anonymous access (no user)
     */
    private String buildFooterTextForExternal(String ipAddress, Long documentId) {
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        String fingerPrint = resolveFingerprintForDocument(documentId, null); // External access
        String ip = ipAddress != null ? ipAddress : "N/A";
        return String.format("UID: ANON | %s | %s | #%s", timestamp, ip, fingerPrint);
    }

    /**
     * Apply watermark to image (PNG, JPEG, GIF, BMP supported).
     * Draws diagonal tiled watermark text using Java2D.
     */
    public byte[] applyWatermarkToImage(byte[] imageContent, User user, String ipAddress, Long documentId)
            throws IOException {
        String employeeNo = user != null && user.getAccountId() != null ? user.getAccountId() : "UNKNOWN";
        return applyWatermarkToImage(imageContent, user, ipAddress, documentId, employeeNo);
    }

    /**
     * Apply watermark to image for external/anonymous share access.
     */
    public byte[] applyWatermarkToImageForExternal(byte[] imageContent, String ipAddress, Long documentId, String shareToken)
            throws IOException {
        String watermarkText = buildWatermarkTextForExternal(ipAddress, documentId, shareToken);
        return applyWatermarkToImageInternal(imageContent, watermarkText);
    }

    private byte[] applyWatermarkToImageInternal(byte[] imageContent, String watermarkText) throws IOException {
        BufferedImage image = ImageIO.read(new ByteArrayInputStream(imageContent));
        if (image == null) {
            log.warn("Failed to decode image, returning original content");
            return imageContent;
        }

        int width = image.getWidth();
        int height = image.getHeight();
        BufferedImage watermarked = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g2d = watermarked.createGraphics();

        g2d.drawImage(image, 0, 0, null);
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g2d.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, WATERMARK_OPACITY));
        g2d.setColor(new Color(85, 85, 85));
        g2d.setFont(buildImageWatermarkFont(width, height));
        drawDiagonalTextOnImage(g2d, width, height, watermarkText);

        g2d.dispose();

        String format = inferImageFormat(imageContent);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        if (!ImageIO.write(watermarked, format, baos)) {
            ImageIO.write(watermarked, "PNG", baos);
        }
        return baos.toByteArray();
    }

    public byte[] applyWatermarkToImage(byte[] imageContent, User user, String ipAddress, Long documentId, String employeeNo)
            throws IOException {
        BufferedImage image = ImageIO.read(new ByteArrayInputStream(imageContent));
        if (image == null) {
            log.warn("Failed to decode image, returning original content");
            return imageContent;
        }
        int width = image.getWidth();
        int height = image.getHeight();
        BufferedImage watermarked = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g2d = watermarked.createGraphics();

        g2d.drawImage(image, 0, 0, null);
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g2d.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, WATERMARK_OPACITY));
        g2d.setColor(new Color(85, 85, 85));
        g2d.setFont(buildImageWatermarkFont(width, height));
        String watermarkText = buildWatermarkText(user, ipAddress, documentId);
        drawDiagonalTextOnImage(g2d, width, height, watermarkText);

        g2d.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, FOOTER_OPACITY));
        g2d.setColor(Color.DARK_GRAY);
        g2d.setFont(new Font("Arial", Font.BOLD, Math.max(13, Math.min(width, height) / 48)));
        String footer = buildFooterText(user, ipAddress, documentId);
        FontMetrics fm = g2d.getFontMetrics();
        int footerWidth = fm.stringWidth(footer);
        int fx = Math.max(12, width - footerWidth - 12);
        int fy = Math.max(18, height - 12);
        int padX = 8;
        int padY = 4;
        int bgX = Math.max(0, fx - padX);
        int bgY = Math.max(0, fy - fm.getAscent() - padY);
        int bgW = Math.min(width - bgX, footerWidth + padX * 2);
        int bgH = Math.min(height - bgY, fm.getHeight() + padY * 2);
        // Draw a solid backdrop first to fully mask any previous footer text.
        g2d.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 1.0f));
        g2d.setColor(FOOTER_BACKGROUND_COLOR);
        g2d.fillRoundRect(bgX, bgY, bgW, bgH, 8, 8);
        g2d.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, FOOTER_OPACITY));
        g2d.setColor(Color.DARK_GRAY);
        g2d.drawString(footer, fx, fy);

        g2d.dispose();

        String format = inferImageFormat(imageContent);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        if (!ImageIO.write(watermarked, format, baos)) {
            ImageIO.write(watermarked, "PNG", baos);
        }
        return baos.toByteArray();
    }

    private Font buildImageWatermarkFont(int width, int height) {
        float scale = computeA4Scale(width, height);
        int fontPx = Math.max(12, Math.round(WATERMARK_BASE_FONT_SIZE_PT * 1.33f * scale));
        return new Font("Arial", Font.PLAIN, fontPx);
    }

    /**
     * Tiles UID watermark on a diagonal grid. Step sizes use string width and line height so
     * adjacent copies do not overlap when rotated (especially for long UID lines).
     */
    private void drawDiagonalTextOnImage(Graphics2D g2d, int width, int height, String watermarkText) {
        FontMetrics fm = g2d.getFontMetrics();
        float textWidth = Math.max(90f, fm.stringWidth(watermarkText));
        float lineHeight = Math.max(10f, fm.getHeight());
        float scale = computeA4Scale(width, height);
        // Horizontal gap along the row: full label width plus margin
        float colStep = Math.max(WATERMARK_BASE_COL_STEP_PT * scale, textWidth * 1.12f + 72f);
        // Vertical advance between rows: must exceed glyph height so lines do not stack on top of each other
        float rowStep = Math.max(WATERMARK_BASE_ROW_STEP_PT * scale, lineHeight * 3.4f);
        colStep = Math.max(180f, colStep);
        rowStep = Math.max(130f, rowStep);

        double rotationRad = Math.toRadians(WATERMARK_ROTATION_DEGREES);
        float startY = height + rowStep;
        float endY = -rowStep;
        for (int rowIndex = 0; ; rowIndex++) {
            float y = startY - (rowIndex * rowStep);
            if (y < endY) break;
            float rowStartX = -textWidth - colStep + computeAlternatingRowOffset(rowIndex, colStep);
            float rowEndX = width + textWidth + colStep;
            for (float x = rowStartX; x <= rowEndX; x += colStep) {
                g2d.rotate(rotationRad, x, y);
                g2d.drawString(watermarkText, x, y);
                g2d.rotate(-rotationRad, x, y);
            }
        }
    }

    /**
     * Clear stagger pattern without creating huge empty bands:
     * - even rows: start at baseline
     * - odd rows: leave a fixed leading blank area before text starts
     */
    private float computeAlternatingRowOffset(int rowIndex, float stepX) {
        if ((rowIndex & 1) == 0) {
            return 0f;
        }
        return WATERMARK_STAGGER_RATIO * stepX;
    }

    private float computeA4Scale(float width, float height) {
        float scaleW = width / A4_WIDTH_PT;
        float scaleH = height / A4_HEIGHT_PT;
        return Math.max(0.6f, Math.min(scaleW, scaleH));
    }

    private String inferImageFormat(byte[] imageContent) {
        if (imageContent.length >= 3) {
            if (imageContent[0] == (byte) 0xFF && imageContent[1] == (byte) 0xD8) return "jpg";
            if (imageContent[0] == (byte) 0x89 && imageContent[1] == 'P' && imageContent[2] == 'N') return "png";
            if (imageContent[0] == 'G' && imageContent[1] == 'I' && imageContent[2] == 'F') return "gif";
            if (imageContent[0] == 'B' && imageContent[1] == 'M') return "bmp";
        }
        return "png";
    }

    /**
     * Determine if file type supports watermarking
     */
    public boolean supportsWatermark(String fileType) {
        if (fileType == null) {
            return false;
        }

        return fileType.equals("application/pdf") ||
               fileType.startsWith("image/");
    }

    /**
     * Apply watermark based on file type
     */
    public byte[] applyWatermark(byte[] content, String fileType, User user, String ipAddress, Long documentId)
            throws IOException {

        if (!supportsWatermark(fileType)) {
            log.debug("File type {} does not support watermarking", fileType);
            return content;
        }

        if (fileType.equals("application/pdf")) {
            return applyWatermarkToPDF(content, user, ipAddress, documentId);
        } else if (fileType.startsWith("image/")) {
            return applyWatermarkToImage(content, user, ipAddress, documentId);
        }

        return content;
    }

    /**
     * Apply watermark for document preview — returns both the watermarked content
     * and the short code / IP used, so the caller can expose consistent metadata in
     * the client-side footer.
     */
    public WatermarkResult applyWatermarkForPreview(byte[] content, String fileType,
                                                    User user, String ipAddress, Long documentId) throws IOException {
        String shortCode = resolveFingerprintForDocument(documentId, user);

        if (!supportsWatermark(fileType)) {
            return new WatermarkResult(content, shortCode, ipAddress);
        }

        if (fileType.equals("application/pdf")) {
            String accountId = user != null && user.getAccountId() != null ? user.getAccountId() : "UNKNOWN";
            String watermarkText = String.format("UID: %s | %s | %s | #%s",
                    accountId,
                    LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")),
                    ipAddress != null ? ipAddress : "N/A",
                    shortCode);
            String footerText = String.format("UID: %s | %s | %s | #%s",
                    accountId,
                    LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")),
                    ipAddress != null ? ipAddress : "N/A",
                    shortCode);

            try (PDDocument document = loadPdfDocument(content);
                 ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
                for (PDPage page : document.getPages()) {
                    applyWatermarkToPage(document, page, watermarkText, footerText);
                }
                document.save(outputStream);
                return new WatermarkResult(outputStream.toByteArray(), shortCode, ipAddress);
            }
        } else if (fileType.startsWith("image/")) {
            String accountId = user != null && user.getAccountId() != null ? user.getAccountId() : "UNKNOWN";
            String watermarkText = String.format("UID: %s | %s | %s | #%s",
                    accountId,
                    LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")),
                    ipAddress != null ? ipAddress : "N/A",
                    shortCode);
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(content));
            if (image == null) {
                return new WatermarkResult(content, shortCode, ipAddress);
            }
            int width = image.getWidth();
            int height = image.getHeight();
            BufferedImage watermarked = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
            Graphics2D g2d = watermarked.createGraphics();
            g2d.drawImage(image, 0, 0, null);
            g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2d.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, WATERMARK_OPACITY));
            g2d.setColor(new Color(85, 85, 85));
            g2d.setFont(buildImageWatermarkFont(width, height));
            drawDiagonalTextOnImage(g2d, width, height, watermarkText);
            g2d.dispose();
            String format = inferImageFormat(content);
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            if (!ImageIO.write(watermarked, format, baos)) {
                ImageIO.write(watermarked, "PNG", baos);
            }
            return new WatermarkResult(baos.toByteArray(), shortCode, ipAddress);
        }

        return new WatermarkResult(content, shortCode, ipAddress);
    }

    /**
     * Apply watermark for anonymous/external share link access
     *
     * @param pdfContent Original PDF content
     * @param ipAddress IP address of viewer
     * @param documentId Document ID
     * @param shareToken Share link token (for tracking)
     * @return Watermarked PDF content
     * @throws IOException If PDF processing fails
     */
    public byte[] applyWatermarkForExternalAccess(byte[] pdfContent, String ipAddress, Long documentId, String shareToken)
            throws IOException {
        log.debug("Applying watermark for external access from IP: {}", ipAddress);

        try (PDDocument document = loadPdfDocument(pdfContent);
             ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {

            // Build watermark text for anonymous user
            String watermarkText = buildWatermarkTextForExternal(ipAddress, documentId, shareToken);
            String footerText = buildFooterTextForExternal(ipAddress, documentId);

            // Apply watermark to each page
            for (PDPage page : document.getPages()) {
                applyWatermarkToPage(document, page, watermarkText, footerText);
            }

            // Save watermarked document
            document.save(outputStream);

            log.info("External watermark applied successfully: {} pages processed", document.getNumberOfPages());
            return outputStream.toByteArray();
        }
    }

    /**
     * Build watermark text for external/anonymous access
     */
    private String buildWatermarkTextForExternal(String ipAddress, Long documentId, String shareToken) {
        String startTime = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        String ip = ipAddress != null ? ipAddress : "N/A";
        String token = shareToken != null ? shareToken : "ANON";

        String fingerPrint = resolveFingerprintForDocument(documentId, null); // external access has no user
        return String.format("UID: %s | %s | %s | #%s", token, startTime, ip, fingerPrint);
    }

    /**
     * Apply watermark for external access based on file type
     */
    public byte[] applyWatermarkForExternalAccess(byte[] content, String fileType, String ipAddress, Long documentId, String shareToken)
            throws IOException {

        if (!supportsWatermark(fileType)) {
            log.debug("File type {} does not support watermarking", fileType);
            return content;
        }

        if (fileType.equals("application/pdf")) {
            return applyWatermarkForExternalAccess(content, ipAddress, documentId, shareToken);
        } else if (fileType.startsWith("image/")) {
            return applyWatermarkToImageForExternal(content, ipAddress, documentId, shareToken);
        }

        return content;
    }

    /**
     * Helper to load a PDF document using reflection so we don't depend on a specific
     * PDFBox PDDocument.load(...) signature (different versions expose different overloads).
     */
    private PDDocument loadPdfDocument(byte[] content) throws IOException {
        try {
            return Loader.loadPDF(content);
        } catch (Exception e) {
            log.error("Failed to load PDF with PDFBox", e);
            throw new IOException("Failed to load PDF document: " + e.getMessage(), e);
        }
    }
}
