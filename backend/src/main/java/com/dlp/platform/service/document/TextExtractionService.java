package com.dlp.platform.service.document;

import lombok.extern.slf4j.Slf4j;
import net.sourceforge.tess4j.Tesseract;
import net.sourceforge.tess4j.TesseractException;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.tika.Tika;
import org.apache.tika.exception.TikaException;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.parser.AutoDetectParser;
import org.apache.tika.parser.ParseContext;
import org.apache.tika.parser.Parser;
import org.apache.tika.sax.BodyContentHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.xml.sax.SAXException;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;

/**
 * Text extraction service supporting PDF, Office docs, images via OCR, and plain text.
 */
@Service
@Slf4j
public class TextExtractionService {

    private static final int MAX_TEXT_LENGTH = 1000000;
    private static final int CHUNK_SIZE = 1000;

    private static final List<String> PDF_TYPES = Arrays.asList("application/pdf");
    private static final List<String> OFFICE_TYPES = Arrays.asList(
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );
    private static final List<String> TEXT_TYPES = Arrays.asList(
        "text/plain", "text/csv", "text/html", "text/xml",
        "application/json", "application/xml"
    );
    private static final List<String> IMAGE_TYPES = Arrays.asList(
        "image/jpeg", "image/png", "image/tiff", "image/bmp", "image/gif"
    );

    @Value("${ocr.tesseract.enabled:true}")
    private boolean ocrEnabled;

    @Value("${ocr.tesseract.datapath:}")
    private String ocrDatapath;

    @Value("${ocr.tesseract.language:eng}")
    private String ocrLanguage;

    public String extractText(byte[] fileContent, String fileType, String fileName) throws IOException {
        log.info("Extracting text from file: {} (type: {})", fileName, fileType);

        if (fileContent == null || fileContent.length == 0) {
            log.warn("Empty file content for: {}", fileName);
            return "";
        }

        try {
            String extractedText = "";

            if (TEXT_TYPES.contains(fileType)) {
                extractedText = extractTextFromPlainText(fileContent);
            } else if (PDF_TYPES.contains(fileType)) {
                extractedText = extractTextFromPDF(fileContent);
            } else if (OFFICE_TYPES.contains(fileType)) {
                extractedText = extractTextFromOffice(fileContent, fileType);
            } else if (IMAGE_TYPES.contains(fileType)) {
                extractedText = extractTextFromImage(fileContent, fileName);
            } else {
                log.warn("Unknown file type {}, attempting auto-detection", fileType);
                extractedText = extractWithTikaAutoDetect(fileContent);
            }

            extractedText = preprocessText(extractedText);

            if (extractedText.length() > MAX_TEXT_LENGTH) {
                log.warn("Text too long ({}), truncating to {}", extractedText.length(), MAX_TEXT_LENGTH);
                extractedText = extractedText.substring(0, MAX_TEXT_LENGTH);
            }

            log.info("Successfully extracted {} characters from {}", extractedText.length(), fileName);
            return extractedText;

        } catch (Exception e) {
            String message = e.getMessage() == null ? "" : e.getMessage().toLowerCase();
            boolean expectedNonExtractable = message.contains("cannot decrypt")
                    || message.contains("password")
                    || message.contains("encrypted");
            if (expectedNonExtractable) {
                log.warn("Text extraction unavailable for file {} (encrypted or non-extractable)", fileName);
                throw new IOException("Cannot decrypt PDF: encrypted document", e);
            } else {
                log.error("Error extracting text from file: {}", fileName, e);
                throw new IOException("Text extraction unavailable (non-extractable document)", e);
            }
        }
    }

    private String extractTextFromPlainText(byte[] fileContent) {
        return new String(fileContent, StandardCharsets.UTF_8);
    }

    private String extractTextFromPDF(byte[] fileContent) throws IOException {
        log.debug("Extracting text from PDF using PDFBox");

        try (PDDocument document = loadPdfDocument(fileContent)) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);

            String text = stripper.getText(document);
            int pageCount = document.getNumberOfPages();
            log.debug("Extracted {} pages from PDF, {} characters extracted", pageCount, text.length());

            if ((text == null || text.isBlank()) && pageCount > 0 && ocrEnabled) {
                log.info("PDF has no extractable text layer (scanned PDF?), attempting OCR on {} pages", pageCount);
                PDFRenderer pdfRenderer = new PDFRenderer(document);
                StringBuilder ocrText = new StringBuilder();
                for (int i = 0; i < pageCount; i++) {
                    try {
                        BufferedImage pageImage = pdfRenderer.renderImageWithDPI(i, 300, ImageType.RGB);
                        String pageText = runTesseractOcr(pageImage);
                        if (pageText != null && !pageText.isBlank()) {
                            ocrText.append(pageText).append("\n");
                            log.debug("OCR extracted {} chars from page {}", pageText.length(), i + 1);
                        }
                    } catch (Exception e) {
                        log.debug("OCR failed for page {}: {}", i + 1, e.getMessage());
                    }
                }
                if (ocrText.length() > 0) {
                    log.info("OCR extracted {} characters from scanned PDF ({} pages)", ocrText.length(), pageCount);
                    return ocrText.toString();
                }
            }

            return text;
        }
    }

    private PDDocument loadPdfDocument(byte[] content) throws IOException {
        try {
            return Loader.loadPDF(content);
        } catch (Exception e) {
            try {
                return Loader.loadPDF(content, "");
            } catch (Exception ignored) {
                String msg = e.getMessage() == null ? "unknown" : e.getMessage();
                String lower = msg.toLowerCase();
                if (lower.contains("cannot decrypt") || lower.contains("password") || lower.contains("encrypted")) {
                    log.warn("PDF cannot be decrypted for text extraction");
                    throw new IOException("Cannot decrypt PDF: encrypted document", e);
                }
                log.warn("PDF text extraction unavailable: {}", msg);
                throw new IOException("PDF text extraction unavailable (non-extractable document)", e);
            }
        }
    }

    private String extractTextFromOffice(byte[] fileContent, String fileType) throws IOException {
        log.debug("Extracting text from Office document type: {}", fileType);

        try (InputStream inputStream = new ByteArrayInputStream(fileContent)) {
            Parser parser = new AutoDetectParser();
            BodyContentHandler handler = new BodyContentHandler(MAX_TEXT_LENGTH);
            Metadata metadata = new Metadata();
            ParseContext context = new ParseContext();

            parser.parse(inputStream, handler, metadata, context);

            String text = handler.toString();
            log.debug("Extracted {} characters from Office document", text.length());

            return text;

        } catch (SAXException | TikaException e) {
            log.error("Tika parsing error", e);
            throw new IOException("Failed to parse Office document: " + e.getMessage(), e);
        }
    }

    private String extractTextFromImage(byte[] fileContent, String fileName) throws IOException {
        if (ocrEnabled) {
            try {
                String text = runTesseractOcr(fileContent);
                if (text != null && !text.isBlank()) {
                    log.info("Tesseract OCR extracted {} characters from image: {}", text.length(), fileName);
                    return text;
                }
            } catch (Exception e) {
                log.warn("Tesseract OCR failed for image {}: {}", fileName, e.getMessage());
            }
        } else {
            log.debug("OCR disabled, skipping Tesseract for image: {}", fileName);
        }

        try {
            String tikaText = extractWithTikaAutoDetect(fileContent);
            if (tikaText != null && !tikaText.isBlank()) {
                return tikaText;
            }
        } catch (Exception e) {
            log.debug("Tika auto-detection for image failed: {}", e.getMessage());
        }

        return String.format("[Image file: %s - no text extracted]", fileName);
    }

    private String runTesseractOcr(byte[] fileContent) throws TesseractException, IOException {
        BufferedImage image = ImageIO.read(new ByteArrayInputStream(fileContent));
        if (image == null) {
            log.warn("Could not decode image for OCR");
            return null;
        }
        return runTesseractOcr(image);
    }

    private String runTesseractOcr(BufferedImage image) throws TesseractException {
        if (image == null) {
            return null;
        }

        Tesseract tesseract = new Tesseract();
        if (ocrDatapath != null && !ocrDatapath.isBlank()) {
            tesseract.setDatapath(ocrDatapath.trim());
        }
        tesseract.setLanguage(ocrLanguage != null && !ocrLanguage.isBlank() ? ocrLanguage.trim() : "eng");

        return tesseract.doOCR(image);
    }

    private String extractWithTikaAutoDetect(byte[] fileContent) throws IOException {
        log.debug("Using Tika auto-detection for text extraction");

        Tika tika = new Tika();
        tika.setMaxStringLength(MAX_TEXT_LENGTH);

        try (InputStream inputStream = new ByteArrayInputStream(fileContent)) {
            try {
                return tika.parseToString(inputStream);
            } catch (TikaException e) {
                log.error("Tika auto-detection parsing error", e);
                throw new IOException("Failed to auto-detect and parse document: " + e.getMessage(), e);
            }
        }
    }

    public String preprocessText(String text) {
        if (text == null || text.isEmpty()) {
            return "";
        }

        text = text.replaceAll("[\\p{Cntrl}&&[^\n\t]]", " ");
        text = text.replaceAll("\\r\\n?", "\n");
        text = text.replaceAll(" {3,}", "  ");
        text = text.replaceAll("\\n{3,}", "\n\n");

        return text.trim();
    }

    public List<String> chunkText(String text, int chunkSize, int overlap) {
        if (text == null || text.isEmpty()) {
            return List.of();
        }

        if (chunkSize <= 0) {
            chunkSize = CHUNK_SIZE;
        }

        if (overlap < 0 || overlap >= chunkSize) {
            overlap = 0;
        }

        List<String> chunks = new java.util.ArrayList<>();
        int start = 0;
        int textLength = text.length();

        while (start < textLength) {
            int end = Math.min(start + chunkSize, textLength);

            if (end < textLength) {
                String segment = text.substring(Math.max(start, end - 100), end);
                int lastPeriod = Math.max(
                    segment.lastIndexOf(". "),
                    Math.max(segment.lastIndexOf("。"), segment.lastIndexOf("! "))
                );

                if (lastPeriod > 0) {
                    end = end - (segment.length() - lastPeriod - 1);
                }
            }

            chunks.add(text.substring(start, end).trim());
            start = end - overlap;
        }

        log.debug("Chunked text into {} segments", chunks.size());
        return chunks;
    }

    public String detectLanguage(String text) {
        if (text == null || text.length() < 50) {
            return "unknown";
        }

        long cjkCount = text.chars()
            .filter(c -> Character.UnicodeBlock.of(c) == Character.UnicodeBlock.CJK_UNIFIED_IDEOGRAPHS)
            .count();

        double cjkRatio = (double) cjkCount / text.length();

        if (cjkRatio > 0.3) {
            return "zh";
        } else {
            return "en";
        }
    }

    public TextStats getTextStats(String text) {
        if (text == null || text.isEmpty()) {
            return new TextStats(0, 0, 0, 0);
        }

        int charCount = text.length();
        int wordCount = text.split("\\s+").length;
        int lineCount = text.split("\\n").length;
        int paragraphCount = text.split("\\n\\n").length;

        return new TextStats(charCount, wordCount, lineCount, paragraphCount);
    }

    public record TextStats(
        int characterCount,
        int wordCount,
        int lineCount,
        int paragraphCount
    ) {}
}
