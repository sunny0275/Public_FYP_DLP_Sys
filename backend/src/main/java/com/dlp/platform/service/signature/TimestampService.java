package com.dlp.platform.service.signature;

import lombok.extern.slf4j.Slf4j;
import org.bouncycastle.asn1.ASN1ObjectIdentifier;
import org.bouncycastle.asn1.cmp.PKIStatus;
import org.bouncycastle.tsp.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.*;
import java.math.BigInteger;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Base64;

/**
 * Service for managing RFC 3161 timestamping
 *
 * RFC 3161 provides cryptographic proof of when a document was signed,
 * preventing backdating or time manipulation attacks.
 *
 * Implementation:
 * - Requests timestamps from Time Stamp Authority (TSA)
 * - Verifies timestamp tokens
 * - Supports multiple TSA providers
 *
 * Default TSA: FreeTSA (https://freetsa.org) for development/testing
 * Production: Should use commercial TSA (DigiCert, Sectigo, etc.)
 */
@Service
@Slf4j
public class TimestampService {

    @Value("${dlp.timestamp.tsa-url:https://freetsa.org/tsr}")
    private String tsaUrl;

    @Value("${dlp.timestamp.enabled:true}")
    private boolean timestampEnabled;

    @Value("${dlp.timestamp.timeout:10000}")
    private int connectionTimeout; // milliseconds

    /**
     * Request RFC 3161 timestamp for data hash
     *
     * @param dataHash SHA-256 hash of the data to timestamp (hex string)
     * @return Base64-encoded timestamp token
     */
    public String requestTimestamp(String dataHash) throws Exception {
        if (!timestampEnabled) {
            log.warn("Timestamping is disabled, returning mock timestamp");
            return createMockTimestamp();
        }

        log.info("Requesting RFC 3161 timestamp from TSA: {}", tsaUrl);

        try {
            // Hash the data (if not already hashed)
            byte[] hashBytes;
            if (dataHash.length() == 64) { // Assume it's already a SHA-256 hex hash
                hashBytes = hexToBytes(dataHash);
            } else {
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                hashBytes = digest.digest(dataHash.getBytes());
            }

            // Create timestamp request
            TimeStampRequestGenerator reqGen = new TimeStampRequestGenerator();
            reqGen.setCertReq(true); // Request TSA certificate in response

            // Generate nonce for replay attack prevention
            BigInteger nonce = BigInteger.valueOf(System.currentTimeMillis());

            TimeStampRequest tsRequest = reqGen.generate(
                TSPAlgorithms.SHA256,
                hashBytes,
                nonce
            );

            // Send request to TSA
            byte[] requestBytes = tsRequest.getEncoded();

            HttpURLConnection connection = (HttpURLConnection) new URL(tsaUrl).openConnection();
            connection.setDoOutput(true);
            connection.setDoInput(true);
            connection.setRequestMethod("POST");
            connection.setRequestProperty("Content-Type", "application/timestamp-query");
            connection.setRequestProperty("Content-Length", String.valueOf(requestBytes.length));
            connection.setConnectTimeout(connectionTimeout);
            connection.setReadTimeout(connectionTimeout);

            // Write request
            try (OutputStream out = connection.getOutputStream()) {
                out.write(requestBytes);
                out.flush();
            }

            // Read response
            int responseCode = connection.getResponseCode();
            if (responseCode != HttpURLConnection.HTTP_OK) {
                throw new IOException("TSA request failed with HTTP " + responseCode);
            }

            TimeStampResponse tsResponse;
            try (InputStream in = connection.getInputStream()) {
                tsResponse = new TimeStampResponse(in);
            }

            // Validate response
            tsResponse.validate(tsRequest);

            if (tsResponse.getStatus() != PKIStatus.GRANTED &&
                tsResponse.getStatus() != PKIStatus.GRANTED_WITH_MODS) {
                String failInfo = tsResponse.getFailInfo() != null ?
                    tsResponse.getFailInfo().toString() : "Unknown";
                throw new IOException("TSA request failed: " + tsResponse.getStatusString() +
                    " (FailInfo: " + failInfo + ")");
            }

            // Extract and encode timestamp token
            TimeStampToken tsToken = tsResponse.getTimeStampToken();
            if (tsToken == null) {
                throw new IOException("TSA response contains no timestamp token");
            }

            byte[] tokenBytes = tsToken.getEncoded();
            String timestampToken = Base64.getEncoder().encodeToString(tokenBytes);

            log.info("RFC 3161 timestamp received successfully: {} bytes, GenTime: {}",
                tokenBytes.length,
                tsToken.getTimeStampInfo().getGenTime());

            return timestampToken;

        } catch (Exception e) {
            log.error("Failed to obtain timestamp from TSA: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to obtain cryptographic timestamp", e);
        }
    }

    /**
     * Verify timestamp token authenticity
     *
     * @param timestampToken Base64-encoded timestamp token
     * @param dataHash Original data hash that was timestamped
     * @return true if timestamp is valid
     */
    public boolean verifyTimestamp(String timestampToken, String dataHash) throws Exception {
        log.debug("Verifying RFC 3161 timestamp token");

        try {
            // Decode token
            byte[] tokenBytes = Base64.getDecoder().decode(timestampToken);
            TimeStampToken tsToken = new TimeStampToken(
                new org.bouncycastle.cms.CMSSignedData(tokenBytes)
            );

            // Get timestamp info
            TimeStampTokenInfo tsInfo = tsToken.getTimeStampInfo();

            // Verify hash algorithm
            if (!tsInfo.getHashAlgorithm().getAlgorithm().equals(
                new ASN1ObjectIdentifier("2.16.840.1.101.3.4.2.1"))) { // SHA-256 OID
                log.warn("Timestamp uses unsupported hash algorithm: {}",
                    tsInfo.getHashAlgorithm().getAlgorithm());
                return false;
            }

            // Verify message imprint (hashed data)
            byte[] expectedHash;
            if (dataHash.length() == 64) {
                expectedHash = hexToBytes(dataHash);
            } else {
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                expectedHash = digest.digest(dataHash.getBytes());
            }

            byte[] actualHash = tsInfo.getMessageImprintDigest();

            if (!MessageDigest.isEqual(expectedHash, actualHash)) {
                log.error("Timestamp message imprint does not match data hash");
                return false;
            }

            log.info("Timestamp verified successfully: GenTime={}, TSA={}",
                tsInfo.getGenTime(), tsInfo.getTsa());

            return true;

        } catch (Exception e) {
            log.error("Timestamp verification failed: {}", e.getMessage(), e);
            return false;
        }
    }

    /**
     * Get timestamp generation time from token
     *
     * @param timestampToken Base64-encoded timestamp token
     * @return Generation time as ISO 8601 string
     */
    public String getTimestampTime(String timestampToken) throws Exception {
        byte[] tokenBytes = Base64.getDecoder().decode(timestampToken);
        TimeStampToken tsToken = new TimeStampToken(
            new org.bouncycastle.cms.CMSSignedData(tokenBytes)
        );

        return tsToken.getTimeStampInfo().getGenTime().toString();
    }

    /**
     * Create mock timestamp for testing when TSA is unavailable
     * DO NOT USE IN PRODUCTION
     */
    private String createMockTimestamp() {
        log.warn("Creating MOCK timestamp - NOT CRYPTOGRAPHICALLY SECURE");

        String mockToken = String.format("MOCK_TIMESTAMP_%d", System.currentTimeMillis());
        return Base64.getEncoder().encodeToString(mockToken.getBytes());
    }

    /**
     * Check if timestamping is enabled
     */
    public boolean isEnabled() {
        return timestampEnabled;
    }

    // Helper methods

    private byte[] hexToBytes(String hex) {
        int len = hex.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4)
                + Character.digit(hex.charAt(i + 1), 16));
        }
        return data;
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder result = new StringBuilder();
        for (byte b : bytes) {
            result.append(String.format("%02x", b));
        }
        return result.toString();
    }
}
