package com.dlp.platform.service.document;

import com.dlp.platform.entity.User;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Blind Watermark Service - Bridge to Python s2c-blind-watermark implementation.
 * 
 * Integrates the s2c blind watermark system which provides:
 * - Invisible BPSK blind watermark (survives Photoshop content-aware fill)
 * - Four-corner registration marks for geometric correction
 * - Partial crop resistance (upper-only capture still decodable)
 * - CRC-validated payload extraction
 * 
 * This service provides a Java bridge to call the Python embed.py and extract.py scripts.
 * 
 * Integration with DLP Platform:
 * - Called during upload pipeline (applyWatermarkingLayers step)
 * - Payload encodes: userId (8-bit) + timeSlot (4-bit) + CRC (8-bit) = 20 bits total
 * - Traceback: extracted userId/time can be looked up in WatermarkFingerprintService
 */
@Service
@Slf4j
public class BlindWatermarkService {

    private static final Pattern EXTRACT_OK_PATTERN = Pattern.compile("OK");
    private static final Pattern EXTRACT_CRC_FAIL_PATTERN = Pattern.compile("CRC_FAIL");
    private static final Pattern USERID_PATTERN = Pattern.compile("userid:\\s*(\\d+)");
    private static final Pattern TIME_PATTERN = Pattern.compile("time:\\s*(\\d+)");
    private static final Pattern BITS_PATTERN = Pattern.compile("bits:\\s*([01]+)");
    private static final Pattern CORNER_SCORES_PATTERN = Pattern.compile("corner_scores:\\s*\\{(.+?)\\}");

    @Value("${blind-watermark.enabled:true}")
    private boolean enabled;

    @Value("${blind-watermark.script-dir:${user.dir}/backend/s2c-blind-watermark}")
    private String scriptDir;

    @Value("${blind-watermark.python-exe:python}")
    private String pythonExe;

    @Value("${blind-watermark.profile:stealth}")
    private String profile;

    @Value("${blind-watermark.tiled-text:}")
    private String tiledText;

    @Value("${blind-watermark.delta-y:10.0}")
    private float deltaY;

    @Value("${blind-watermark.mark-delta-y:18.0}")
    private float markDeltaY;

    @Value("${blind-watermark.timeout-seconds:30}")
    private int timeoutSeconds;

    private final Path tempDir;

    public BlindWatermarkService() {
        try {
            this.tempDir = Files.createTempDirectory("dlp-blind-wm-");
            log.info("Blind watermark temp directory: {}", tempDir);
        } catch (IOException e) {
            throw new RuntimeException("Failed to create temp directory for blind watermark", e);
        }
    }

    /**
     * Embed blind watermark into an image.
     * 
     * Payload is computed from userId and a timeSlot to create a 20-bit signature:
     * - 8 bits: userId (0-255)
     * - 4 bits: timeSlot (0-15)
     * - 8 bits: CRC-8 checksum
     * 
     * @param imageBytes Input image bytes (PNG, JPEG, BMP, etc.)
     * @param user User who will be associated with this watermark
     * @param documentId Document ID for logging
     * @return Watermarked image bytes, or original if embedding fails
     */
    public byte[] embedBlindWatermark(byte[] imageBytes, User user, Long documentId) {
        if (!enabled) {
            log.debug("Blind watermark disabled, skipping embed for document {}", documentId);
            return imageBytes;
        }

        int userId = extractUserId(user);
        int timeSlot = generateTimeSlot();

        log.info("Embedding blind watermark: documentId={}, userId={}, timeSlot={}, profile={}",
            documentId, userId, timeSlot, profile);

        Path inputFile = null;
        Path outputFile = null;

        try {
            // Determine format from image bytes magic bytes
            String format = detectImageFormat(imageBytes);
            String outputFormat = "png"; // Always output as PNG for lossless

            inputFile = tempDir.resolve("embed_input_" + documentId + "." + format);
            outputFile = tempDir.resolve("embed_output_" + documentId + "." + outputFormat);

            // Write input file
            Files.write(inputFile, imageBytes);

            // Build command
            int wmId = ((userId << 4) | (timeSlot & 0xF)) & 0xFFF;
            log.debug("Computing wm_id: userId={}, timeSlot={}, wmId={}", userId, timeSlot, wmId);
            
            String embedScript = resolveScript("embed.py");
            if (embedScript == null) {
                log.error("embed.py not found in {}", scriptDir);
                return imageBytes;
            }

            ProcessBuilder pb = new ProcessBuilder(
                pythonExe,
                embedScript,
                "--in", inputFile.toString(),
                "--out", outputFile.toString(),
                "--profile", profile,
                "--delta-y", String.valueOf(deltaY),
                "--mark-delta-y", String.valueOf(markDeltaY),
                "--tiled-text", tiledText
            );
            pb.directory(new File(scriptDir));
            pb.redirectErrorStream(true);

            Process process = pb.start();
            String output = readProcessOutput(process);
            int exitCode = process.waitFor(timeoutSeconds, TimeUnit.SECONDS) ? process.exitValue() : -1;

            if (exitCode != 0 || !Files.exists(outputFile)) {
                log.error("Blind watermark embed failed: exitCode={}, output={}", exitCode, output);
                return imageBytes;
            }

            byte[] result = Files.readAllBytes(outputFile);
            log.info("Blind watermark embedded successfully: documentId={}, outputSize={}", 
                documentId, result.length);

            return result;

        } catch (Exception e) {
            log.error("Error embedding blind watermark for document {}: {}", documentId, e.getMessage(), e);
            return imageBytes;
        } finally {
            cleanupFile(inputFile);
            cleanupFile(outputFile);
        }
    }

    /**
     * Embed blind watermark into PDF by first converting to image, watermarking, then returning.
     * Note: For PDFs, we apply blind watermark to rendered pages as images.
     * 
     * @param pdfBytes Input PDF bytes
     * @param user User for watermark payload
     * @param documentId Document ID
     * @return Same PDF bytes (PDF watermarking done by WatermarkService)
     */
    public byte[] embedBlindWatermarkForPdf(byte[] pdfBytes, User user, Long documentId) {
        // For PDFs, blind watermark is embedded by the PDF rendering pipeline
        // This method is a placeholder for future PDF page-by-page watermarking
        if (!enabled) {
            return pdfBytes;
        }
        
        // Currently, blind watermark for PDFs would require:
        // 1. Render each PDF page to image
        // 2. Embed blind watermark
        // 3. Replace page with watermarked version
        // 
        // For now, we rely on WatermarkService's visible watermark for PDFs
        // and blind watermark for images only
        log.debug("Blind watermark for PDF document {} deferred to image rendering pipeline", documentId);
        return pdfBytes;
    }

    /**
     * Extract blind watermark from an image.
     * 
     * @param imageBytes Image bytes potentially containing blind watermark
     * @param documentId Document ID for logging
     * @return Extraction result containing userId, timeSlot, and metadata
     */
    public ExtractionResult extractBlindWatermark(byte[] imageBytes, Long documentId) {
        if (!enabled) {
            log.debug("Blind watermark disabled, skipping extract for document {}", documentId);
            return ExtractionResult.notDetected();
        }

        Path inputFile = null;
        Path warpedFile = null;

        try {
            String format = detectImageFormat(imageBytes);
            
            inputFile = tempDir.resolve("extract_input_" + documentId + "." + format);
            warpedFile = tempDir.resolve("extract_warped_" + documentId + ".png");

            // Write input file
            Files.write(inputFile, imageBytes);

            // Build command
            String extractScript = resolveScript("extract.py");
            if (extractScript == null) {
                log.error("extract.py not found in {}", scriptDir);
                return ExtractionResult.notDetected();
            }

            ProcessBuilder pb = new ProcessBuilder(
                pythonExe,
                extractScript,
                "--in", inputFile.toString(),
                "--save-warped", warpedFile.toString()
            );
            pb.directory(new File(scriptDir));
            pb.redirectErrorStream(true);

            Process process = pb.start();
            String output = readProcessOutput(process);
            boolean finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
            int exitCode = finished ? process.exitValue() : -1;

            if (exitCode != 0) {
                log.warn("Blind watermark extract process failed: exitCode={}, output={}", exitCode, output);
                return ExtractionResult.notDetected();
            }

            return parseExtractionOutput(output, warpedFile);

        } catch (Exception e) {
            log.error("Error extracting blind watermark for document {}: {}", documentId, e.getMessage(), e);
            return ExtractionResult.notDetected();
        } finally {
            cleanupFile(inputFile);
            cleanupFile(warpedFile);
        }
    }

    /**
     * Check if blind watermark is enabled.
     */
    public boolean isEnabled() {
        return enabled;
    }

    /**
     * Check if Python scripts are available.
     */
    public boolean isAvailable() {
        if (!enabled) return false;
        
        String embedScript = resolveScript("embed.py");
        String extractScript = resolveScript("extract.py");
        
        return embedScript != null && extractScript != null;
    }

    /**
     * Get the wm_id for a given user and document.
     * This encodes userId (8-bit) and timeSlot (4-bit) into a 12-bit integer.
     */
    public int computeWmId(int userId, int timeSlot) {
        return ((userId & 0xFF) << 4) | (timeSlot & 0xF);
    }

    /**
     * Parse wm_id back to userId and timeSlot.
     */
    public int[] parseWmId(int wmId) {
        return new int[] { (wmId >> 4) & 0xFF, wmId & 0xF };
    }

    // ========== Private helper methods ==========

    private int extractUserId(User user) {
        if (user == null || user.getId() == null) {
            return 0;
        }
        return (int) (user.getId() % 256); // 8-bit, wrap around for IDs > 255
    }

    private int generateTimeSlot() {
        // Use current minute as time slot (0-15 based on minute % 16)
        // This provides temporal granularity and allows tracking when watermark was embedded
        return (int) ((System.currentTimeMillis() / 60000) % 16);
    }

    private String detectImageFormat(byte[] bytes) {
        if (bytes == null || bytes.length < 4) {
            return "png";
        }
        
        // PNG: 89 50 4E 47
        if (bytes[0] == (byte) 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47) {
            return "png";
        }
        // JPEG: FF D8 FF
        if (bytes[0] == (byte) 0xFF && bytes[1] == (byte) 0xD8 && bytes[2] == (byte) 0xFF) {
            return "jpg";
        }
        // BMP: 42 4D
        if (bytes[0] == 0x42 && bytes[1] == 0x4D) {
            return "bmp";
        }
        // GIF: 47 49 46
        if (bytes[0] == 0x47 && bytes[1] == 0x49 && bytes[2] == 0x46) {
            return "gif";
        }
        
        return "png";
    }

    private String resolveScript(String scriptName) {
        Path scriptPath = Path.of(scriptDir, scriptName);
        if (Files.exists(scriptPath)) {
            return scriptPath.toString();
        }
        
        // Try alternative locations
        String[] alternatives = {
            scriptDir + "/" + scriptName,
            System.getProperty("user.dir") + "/backend/s2c-blind-watermark/" + scriptName,
            "C:/Code/FYP/backend/s2c-blind-watermark/" + scriptName,
            "D:/Code/FYP/backend/s2c-blind-watermark/" + scriptName
        };
        
        for (String alt : alternatives) {
            Path altPath = Path.of(alt);
            if (Files.exists(altPath)) {
                return altPath.toString();
            }
        }
        
        return null;
    }

    private String readProcessOutput(Process process) throws IOException {
        StringBuilder output = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
            }
        }
        return output.toString();
    }

    private ExtractionResult parseExtractionOutput(String output, Path warpedFile) {
        ExtractionResult result = new ExtractionResult();
        
        result.setRawOutput(output);
        
        // Parse status
        if (EXTRACT_OK_PATTERN.matcher(output).find()) {
            result.setStatus(ExtractionStatus.OK);
        } else if (EXTRACT_CRC_FAIL_PATTERN.matcher(output).find()) {
            result.setStatus(ExtractionStatus.CRC_FAIL);
        } else {
            result.setStatus(ExtractionStatus.NOT_DETECTED);
        }
        
        // Parse userId
        Matcher userIdMatcher = USERID_PATTERN.matcher(output);
        if (userIdMatcher.find()) {
            result.setUserId(Integer.parseInt(userIdMatcher.group(1)));
        }
        
        // Parse timeSlot
        Matcher timeMatcher = TIME_PATTERN.matcher(output);
        if (timeMatcher.find()) {
            result.setTimeSlot(Integer.parseInt(timeMatcher.group(1)));
        }
        
        // Parse bits
        Matcher bitsMatcher = BITS_PATTERN.matcher(output);
        if (bitsMatcher.find()) {
            result.setBits(bitsMatcher.group(1));
        }
        
        // Parse corner scores
        Matcher scoresMatcher = CORNER_SCORES_PATTERN.matcher(output);
        if (scoresMatcher.find()) {
            result.setCornerScoresText(scoresMatcher.group(1));
        }
        
        // Check if warped file exists and has reasonable size
        if (Files.exists(warpedFile)) {
            try {
                long size = Files.size(warpedFile);
                result.setWarpedFileSize(size);
                result.setHasWarpedFile(true);
            } catch (IOException e) {
                log.debug("Could not read warped file size: {}", e.getMessage());
            }
        }
        
        return result;
    }

    private void cleanupFile(Path file) {
        if (file != null) {
            try {
                Files.deleteIfExists(file);
            } catch (IOException e) {
                log.debug("Failed to cleanup temp file {}: {}", file, e.getMessage());
            }
        }
    }

    // ========== Inner classes ==========

    public enum ExtractionStatus {
        OK,
        CRC_FAIL,
        NOT_DETECTED
    }

    public static class ExtractionResult {
        private ExtractionStatus status = ExtractionStatus.NOT_DETECTED;
        private int userId = -1;
        private int timeSlot = -1;
        private String bits = "";
        private String cornerScoresText = "";
        private String rawOutput = "";
        private long warpedFileSize = 0;
        private boolean hasWarpedFile = false;

        public static ExtractionResult notDetected() {
            return new ExtractionResult();
        }

        public boolean isDetected() {
            return status == ExtractionStatus.OK;
        }

        public boolean isCrcValid() {
            return status == ExtractionStatus.OK;
        }

        public int computeWmId() {
            return ((userId & 0xFF) << 4) | (timeSlot & 0xF);
        }

        // Getters and setters
        public ExtractionStatus getStatus() { return status; }
        public void setStatus(ExtractionStatus status) { this.status = status; }
        public int getUserId() { return userId; }
        public void setUserId(int userId) { this.userId = userId; }
        public int getTimeSlot() { return timeSlot; }
        public void setTimeSlot(int timeSlot) { this.timeSlot = timeSlot; }
        public String getBits() { return bits; }
        public void setBits(String bits) { this.bits = bits; }
        public String getCornerScoresText() { return cornerScoresText; }
        public void setCornerScoresText(String cornerScoresText) { this.cornerScoresText = cornerScoresText; }
        public String getRawOutput() { return rawOutput; }
        public void setRawOutput(String rawOutput) { this.rawOutput = rawOutput; }
        public long getWarpedFileSize() { return warpedFileSize; }
        public void setWarpedFileSize(long warpedFileSize) { this.warpedFileSize = warpedFileSize; }
        public boolean isHasWarpedFile() { return hasWarpedFile; }
        public void setHasWarpedFile(boolean hasWarpedFile) { this.hasWarpedFile = hasWarpedFile; }

        @Override
        public String toString() {
            return String.format("ExtractionResult{status=%s, userId=%d, timeSlot=%d, bits='%s', cornerScores='%s'}",
                status, userId, timeSlot, bits, cornerScoresText);
        }
    }
}
