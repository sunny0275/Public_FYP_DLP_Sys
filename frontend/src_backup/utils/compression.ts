/**
 * Client-side compression utilities for large file uploads.
 * Uses pako (gzip) for efficient compression of PDF files approaching the 20MB limit.
 */
import * as pako from 'pako';

export const COMPRESSION_THRESHOLD_BYTES = 20 * 1024 * 1024; // 20MB - trigger compression
export const MIN_COMPRESSION_RATIO = 0.98; // Only keep compressed version if < 98% of original size

/**
 * Compress file content using gzip (pako).
 * Returns compressed Uint8Array that can be sent as binary data with Content-Encoding: gzip header.
 */
export async function gzipCompress(data: Uint8Array): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        try {
            // pako.deflate returns compressed data
            const compressed = pako.deflate(data);
            resolve(compressed);
        } catch (error) {
            reject(new Error(`Gzip compression failed: ${error}`));
        }
    });
}

/**
 * Decompress gzip-compressed data.
 */
export async function gzipDecompress(data: Uint8Array): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        try {
            const decompressed = pako.inflate(data);
            resolve(new Uint8Array(decompressed));
        } catch (error) {
            reject(new Error(`Gzip decompression failed: ${error}`));
        }
    });
}

/**
 * Compress a File object using gzip with fallback for highly compressed files.
 * Strategy:
 * 1. First compression attempt for files >= 20MB
 * 2. If still >= 20MB after compression, attempt second compression
 * 3. Always upload the best compressed version available (never raw file)
 */
export async function compressFileForUpload(file: File): Promise<{ file: File; compressedSize: number; wasCompressed: boolean }> {
    const rawData = new Uint8Array(await file.arrayBuffer());
    const originalSize = rawData.length;

    // No compression needed for small files
    if (originalSize < COMPRESSION_THRESHOLD_BYTES) {
        return { file, compressedSize: originalSize, wasCompressed: false };
    }

    // Round 1: Normal gzip compression
    let compressed = await gzipCompress(rawData);
    let compressedSize = compressed.length;

    if (compressedSize < COMPRESSION_THRESHOLD_BYTES) {
        console.log(`[Compression] Round 1: ${file.name}: ${formatBytes(originalSize)} -> ${formatBytes(compressedSize)}`);
        return { file: createGzipFile(compressed, file), compressedSize, wasCompressed: true };
    }

    // Round 2: Compress the compressed data (for highly compressed/image PDFs)
    compressed = await gzipCompress(compressed);
    compressedSize = compressed.length;
    console.log(`[Compression] Round 2: ${file.name}: ${formatBytes(originalSize)} -> ${formatBytes(compressedSize)}`);

    // Always use the best compressed version (twice-compressed, even if still >= 20MB)
    return { file: createGzipFile(compressed, file), compressedSize, wasCompressed: true };
}

function createGzipFile(compressed: Uint8Array, originalFile: File): File {
    const blob = new Blob([new Uint8Array(compressed)], { type: 'application/gzip' });
    return new File([blob], originalFile.name, { type: 'application/gzip', lastModified: Date.now() });
}

/**
 * Check if a file should be compressed based on size threshold.
 */
export function shouldCompress(file: File): boolean {
    return file.size >= COMPRESSION_THRESHOLD_BYTES;
}

/**
 * Format byte size to human-readable string.
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
