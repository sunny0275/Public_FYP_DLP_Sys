package com.dlp.platform.service.document;

import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;

/**
 * MultipartFile implementation that wraps an in-memory byte array.
 * Used for representing decompressed file data after client-side gzip decompression.
 */
public class DecompressedMultipartFile implements MultipartFile {

    private final byte[] content;
    private final String name;
    private final String contentType;

    public DecompressedMultipartFile(byte[] content, String name, String contentType) {
        this.content = content;
        this.name = name;
        this.contentType = contentType;
    }

    @Override
    public String getName() {
        return name;
    }

    @Override
    public String getOriginalFilename() {
        return name;
    }

    @Override
    public String getContentType() {
        return contentType;
    }

    @Override
    public boolean isEmpty() {
        return content == null || content.length == 0;
    }

    @Override
    public long getSize() {
        return content != null ? content.length : 0;
    }

    @Override
    public byte[] getBytes() throws IOException {
        return content;
    }

    @Override
    public InputStream getInputStream() throws IOException {
        return new ByteArrayInputStream(content);
    }

    @Override
    public void transferTo(File dest) throws IOException, IllegalStateException {
        throw new UnsupportedOperationException("Transfer to file not supported for decompressed in-memory file");
    }

    @Override
    public void transferTo(java.nio.file.Path dest) throws IOException, IllegalStateException {
        throw new UnsupportedOperationException("Transfer to path not supported for decompressed in-memory file");
    }
}
