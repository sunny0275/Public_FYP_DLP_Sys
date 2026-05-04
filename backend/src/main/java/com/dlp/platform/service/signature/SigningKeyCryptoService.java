package com.dlp.platform.service.signature;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Encrypt/decrypt per-user signing private keys for storage in DB.
 *
 * Design:
 * - AES-256-GCM with random 12-byte IV
 * - Stored format: "v1:" + base64( iv || ciphertext_with_tag )
 *
 * NOTE: Secret comes from dlp.signature.key-encryption-secret (fallbacks to JWT_SECRET).
 */
@Service
@Slf4j
public class SigningKeyCryptoService {

    private final SecretKey key;
    private final SecureRandom secureRandom = new SecureRandom();

    public SigningKeyCryptoService(@Value("${dlp.signature.key-encryption-secret}") String secret) {
        if (secret == null || secret.trim().isEmpty()) {
            throw new IllegalStateException("Missing required config: dlp.signature.key-encryption-secret");
        }
        this.key = new SecretKeySpec(sha256(secret.trim()), "AES");
    }

    public String encrypt(byte[] plaintext) {
        try {
            byte[] iv = new byte[12];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
            byte[] ct = cipher.doFinal(plaintext);

            byte[] packed = new byte[iv.length + ct.length];
            System.arraycopy(iv, 0, packed, 0, iv.length);
            System.arraycopy(ct, 0, packed, iv.length, ct.length);

            return "v1:" + Base64.getEncoder().encodeToString(packed);
        } catch (Exception e) {
            log.error("Failed to encrypt signing key", e);
            throw new RuntimeException("Failed to encrypt signing key", e);
        }
    }

    public byte[] decrypt(String stored) {
        try {
            if (stored == null || stored.isBlank()) return null;
            String s = stored.trim();
            if (!s.startsWith("v1:")) {
                throw new IllegalArgumentException("Unsupported signing key cipher format");
            }
            byte[] packed = Base64.getDecoder().decode(s.substring(3));
            if (packed.length < 12 + 16) {
                throw new IllegalArgumentException("Corrupted signing key cipher text");
            }
            byte[] iv = new byte[12];
            System.arraycopy(packed, 0, iv, 0, 12);
            byte[] ct = new byte[packed.length - 12];
            System.arraycopy(packed, 12, ct, 0, ct.length);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, iv));
            return cipher.doFinal(ct);
        } catch (Exception e) {
            log.error("Failed to decrypt signing key", e);
            throw new RuntimeException("Failed to decrypt signing key", e);
        }
    }

    private static byte[] sha256(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return md.digest(s.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new RuntimeException("Failed to hash secret", e);
        }
    }
}


