package com.dlp.platform.util;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.warrenstrange.googleauth.GoogleAuthenticator;
import com.warrenstrange.googleauth.GoogleAuthenticatorKey;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Base64;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Slf4j
@Component
public class MfaUtil {

    @Value("${security.mfa.issuer}")
    private String issuer;

    @Value("${security.mfa.qr-code-width:200}")
    private int qrCodeWidth;

    @Value("${security.mfa.qr-code-height:200}")
    private int qrCodeHeight;

    private final GoogleAuthenticator googleAuthenticator;

    public MfaUtil() {
        this.googleAuthenticator = new GoogleAuthenticator();
    }

    /**
     * Generate a new MFA secret key for a user
     */
    public String generateSecretKey() {
        GoogleAuthenticatorKey key = googleAuthenticator.createCredentials();
        String secret = key.getKey();
        log.debug("Generated new MFA secret key");
        return secret;
    }

    /**
     * Generate QR code URL for Google Authenticator
     * Format: otpauth://totp/Issuer:AccountId?secret=SECRET&issuer=Issuer&algorithm=SHA1&digits=6&period=30
     *
     * NOTE:
     *  - We intentionally return the raw otpauth:// URI here (NOT a HTTP image URL).
     *  - The frontend renders a QR code from this string using qrcode.react.
     *  - Authenticator apps expect the QR content to be an otpauth:// URI, so
     *    encoding an HTTP URL (e.g. https://api.qrserver.com/...) would NOT scan correctly.
     */
    public String generateQRCodeUrl(String accountId, String secret) {
        // Fallback account ID if null
        String sanitizedAccountId = accountId != null ? accountId : "user";

        // URL-encode label and issuer components
        String encodedIssuer = URLEncoder.encode(issuer, StandardCharsets.UTF_8);
        String encodedAccountId = URLEncoder.encode(sanitizedAccountId, StandardCharsets.UTF_8);

        // Build otpauth URI directly – this is what authenticator apps expect
        String otpAuthUrl = String.format(
                "otpauth://totp/%s:%s?secret=%s&issuer=%s&algorithm=SHA1&digits=6&period=30",
                encodedIssuer,
                encodedAccountId,
                secret,
                encodedIssuer
        );

        log.info("Generated QR code otpauth URI for account: {} - URI: {}", sanitizedAccountId, otpAuthUrl);
        return otpAuthUrl;
    }

    /**
     * Generate QR code as Base64-encoded PNG image
     * Returns a data URL that can be directly used in an <img> tag
     */
    public String generateQRCodeImage(String accountId, String secret) {
        try {
            String qrCodeUrl = generateQRCodeUrl(accountId, secret);
            log.debug("Generating QR code image for URL: {}", qrCodeUrl);

            // Generate QR code using ZXing
            QRCodeWriter qrCodeWriter = new QRCodeWriter();
            BitMatrix bitMatrix = qrCodeWriter.encode(
                    qrCodeUrl,
                    BarcodeFormat.QR_CODE,
                    qrCodeWidth,
                    qrCodeHeight
            );

            // Convert BitMatrix to PNG image
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(bitMatrix, "PNG", outputStream);
            byte[] qrCodeBytes = outputStream.toByteArray();

            // Encode as Base64 data URL
            String base64Image = Base64.getEncoder().encodeToString(qrCodeBytes);
            String dataUrl = "data:image/png;base64," + base64Image;

            log.info("Generated QR code image for account: {} (size: {} bytes)", accountId, qrCodeBytes.length);
            return dataUrl;

        } catch (WriterException e) {
            log.error("Error writing QR code for account {}: {}", accountId, e.getMessage());
            throw new RuntimeException("Failed to generate QR code: " + e.getMessage(), e);
        } catch (IOException e) {
            log.error("Error encoding QR code image for account {}: {}", accountId, e.getMessage());
            throw new RuntimeException("Failed to encode QR code image: " + e.getMessage(), e);
        }
    }

    /**
     * Verify TOTP code against secret
     */
    public boolean verifyCode(String secret, int code) {
        try {
            boolean isValid = googleAuthenticator.authorize(secret, code);
            log.debug("MFA code verification result: {}", isValid);
            return isValid;
        } catch (Exception e) {
            log.error("Error verifying MFA code: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Verify TOTP code with window tolerance
     * @param secret The user's MFA secret
     * @param code The code to verify
     * @param window Number of time windows to check (default is 3, allowing ±90 seconds)
     * NOTE: The window parameter is kept for API compatibility but the library's window
     * logic can have issues with time sync. We use direct verification which is more reliable.
     */
    public boolean verifyCodeWithWindow(String secret, int code, int window) {
        try {
            log.debug("verifyCodeWithWindow - secret prefix: {}, code: {}, window: {}", 
                secret.substring(0, Math.min(4, secret.length())), code, window);

            // First generate current code to compare
            int serverCurrentCode = googleAuthenticator.getTotpPassword(secret);
            log.debug("verifyCodeWithWindow - server current code: {}", serverCurrentCode);

            // Direct verification without window - more reliable than window-based verification
            // The library's window logic can have time sync issues
            boolean isValid = googleAuthenticator.authorize(secret, code);
            log.debug("verifyCodeWithWindow result: {}", isValid);

            return isValid;
        } catch (Exception e) {
            log.error("Error verifying MFA code with window: {}", e.getMessage(), e);
            return false;
        }
    }

    /**
     * Generate current TOTP code (for testing purposes)
     */
    public int generateCurrentCode(String secret) {
        try {
            int code = googleAuthenticator.getTotpPassword(secret);
            log.debug("Generated current TOTP code");
            return code;
        } catch (Exception e) {
            log.error("Error generating current code: {}", e.getMessage());
            throw new RuntimeException("Failed to generate current code", e);
        }
    }

    /**
     * Validate MFA secret format
     */
    public boolean isValidSecret(String secret) {
        if (secret == null || secret.isEmpty()) {
            return false;
        }

        // Secret should be Base32 encoded and at least 16 characters
        if (secret.length() < 16) {
            return false;
        }

        // Check if it contains only valid Base32 characters (A-Z, 2-7)
        return secret.matches("^[A-Z2-7]+$");
    }

    /**
     * MFA setup data transfer object
     */
    public static class MfaSetupData {
        private final String secret;
        private final String qrCodeUrl;
        private final String qrCodeImage;
        private final String issuer;

        public MfaSetupData(String secret, String qrCodeUrl, String qrCodeImage, String issuer) {
            this.secret = secret;
            this.qrCodeUrl = qrCodeUrl;
            this.qrCodeImage = qrCodeImage;
            this.issuer = issuer;
        }

        public String getSecret() {
            return secret;
        }

        public String getQrCodeUrl() {
            return qrCodeUrl;
        }

        public String getQrCodeImage() {
            return qrCodeImage;
        }

        public String getIssuer() {
            return issuer;
        }
    }

    /**
     * Create complete MFA setup data for a user
     */
    public MfaSetupData createMfaSetup(String accountId) {
        String secret = generateSecretKey();
        String qrCodeUrl = generateQRCodeUrl(accountId, secret);
        String qrCodeImage = generateQRCodeImage(accountId, secret);

        log.info("Created MFA setup for account: {}", accountId);
        return new MfaSetupData(secret, qrCodeUrl, qrCodeImage, issuer);
    }
}
