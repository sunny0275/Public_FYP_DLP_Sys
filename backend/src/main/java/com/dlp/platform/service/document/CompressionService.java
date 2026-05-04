package com.dlp.platform.service.document;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

/**
 * Service for handling file compression/decompression operations.
 * Supports gzip compression for large file uploads to reduce network bandwidth and processing time.
 */
@Service
@Slf4j
public class CompressionService {

    private static final int BUFFER_SIZE = 8192;

    /**
     * Check if the given content type indicates gzip-compressed data.
     */
    public boolean isGzipCompressed(String contentType) {
        return contentType != null && contentType.toLowerCase().contains("gzip");
    }

    /**
     * Decompress gzip-compressed data.
     *
     * @param compressedData The gzip-compressed byte array
     * @return The decompressed data
     * @throws IOException if decompression fails
     */
    public byte[] decompressGzip(byte[] compressedData) throws IOException {
        if (compressedData == null || compressedData.length == 0) {
            throw new IllegalArgumentException("Compressed data is null or empty");
        }

        try (GZIPInputStream gis = new GZIPInputStream(new ByteArrayInputStream(compressedData));
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[BUFFER_SIZE];
            int len;
            while ((len = gis.read(buffer)) > 0) {
                out.write(buffer, 0, len);
            }
            return out.toByteArray();
        } catch (IOException e) {
            log.error("Gzip decompression failed: {}", e.getMessage());
            throw new IOException("Failed to decompress gzip data: " + e.getMessage(), e);
        }
    }

    /**
     * Compress data using gzip.
     *
     * @param data The data to compress
     * @return The gzip-compressed data
     * @throws IOException if compression fails
     */
    public byte[] compressGzip(byte[] data) throws IOException {
        if (data == null || data.length == 0) {
            throw new IllegalArgumentException("Data is null or empty");
        }

        try (ByteArrayOutputStream bos = new ByteArrayOutputStream(data.length);
             GZIPOutputStream gos = new GZIPOutputStream(bos)) {
            gos.write(data);
            gos.finish();
            return bos.toByteArray();
        } catch (IOException e) {
            log.error("Gzip compression failed: {}", e.getMessage());
            throw new IOException("Failed to compress data: " + e.getMessage(), e);
        }
    }

    /**
     * Check if data appears to be gzip-compressed by checking magic bytes.
     * Gzip magic bytes: 0x1f 0x8b
     */
    public boolean isGzipMagicBytes(byte[] data) {
        if (data == null || data.length < 2) {
            return false;
        }
        return (data[0] == (byte) 0x1f) && (data[1] == (byte) 0x8b);
    }
}
