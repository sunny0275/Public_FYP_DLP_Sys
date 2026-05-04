package com.dlp.platform.service.key;

import com.dlp.platform.entity.DocumentKey;
import com.dlp.platform.entity.KeyRecoveryJob;
import com.dlp.platform.entity.User;
import com.dlp.platform.entity.UserKey;
import com.dlp.platform.repository.DocumentKeyRepository;
import com.dlp.platform.repository.KeyRecoveryJobRepository;
import com.dlp.platform.repository.UserKeyRepository;
import com.dlp.platform.repository.UserRepository;
import com.dlp.platform.service.BlockchainService;
import com.dlp.platform.service.audit.AuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;

/**
 * Phase 05: User encryption key lifecycle — setup, derive, revoke, recover, regenerate.
 * Private key is never stored; derived from password + salt. Recovery key encrypted with private key;
 * private key also encrypted with recovery key for password-forgot recovery.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class KeyManagementService {

    private static final int KEY_BYTES = 32;
    private static final int GCM_IV_BYTES = 12;
    private static final int GCM_TAG_BITS = 128;

    @Value("${dlp.key-management.enabled:true}")
    private boolean keyManagementEnabled;

    @Value("${dlp.key-management.pbkdf2-iterations:100000}")
    private int pbkdf2Iterations;

    @Value("${dlp.key-management.mode:USER_SELF_CUSTODY}")
    private String keyManagementMode;

    @Value("${dlp.key-management.operational.active-key-id:${DLP_KEYMGMT_ACTIVE_KEY_ID:v1}}")
    private String operationalActiveKeyId;

    @Value("${dlp.key-management.operational.keyring:${DLP_KEYMGMT_KEYRING:}}")
    private String operationalKeyringRaw;

    @Value("${dlp.key-management.operational.master-secret:${DLP_KEYMGMT_MASTER_SECRET:${dlp.signature.key-encryption-secret:${JWT_SECRET}}}}")
    private String legacyOperationalMasterSecret;

    private final UserKeyRepository userKeyRepository;
    private final UserRepository userRepository;
    private final DocumentKeyRepository documentKeyRepository;
    private final KeyRecoveryJobRepository keyRecoveryJobRepository;
    private final AuditService auditService;
    private final BlockchainService blockchainService;

    private final SecureRandom secureRandom = new SecureRandom();

    public boolean isEnabled() {
        return keyManagementEnabled;
    }

    public String getMode() {
        if (keyManagementMode == null || keyManagementMode.isBlank()) {
            return "USER_SELF_CUSTODY";
        }
        return keyManagementMode.trim().toUpperCase();
    }

    public boolean isAdminEscrowMode() {
        return "ADMIN_ESCROW".equals(getMode());
    }

    public boolean isSelfServiceRecoveryEnabled() {
        return !isAdminEscrowMode();
    }

    /**
     * Initialize key for user (first-time setup). Derives private key from password, generates recovery key,
     * stores encrypted material. Returns recovery key (show once to user).
     */
    @Transactional
    public KeySetupResult setupKey(Long userId, String password) {
        if (!keyManagementEnabled) {
            throw new IllegalStateException("Key management is disabled");
        }
        if (userKeyRepository.existsByUserId(userId)) {
            throw new IllegalArgumentException("User already has a key; use regenerate or recover");
        }

        byte[] salt = new byte[32];
        secureRandom.nextBytes(salt);
        byte[] iv = new byte[GCM_IV_BYTES];
        secureRandom.nextBytes(iv);

        byte[] privateKey = derivePrivateKey(password, salt);
        byte[] recoveryKey = new byte[KEY_BYTES];
        secureRandom.nextBytes(recoveryKey);

        String encryptedRecoveryKey = encryptAesGcm(recoveryKey, privateKey, iv);
        String encryptedPrivateKey = encryptAesGcm(privateKey, recoveryKey, iv);
        WrappedOperationalKey wrappedOperational = encryptWithOperationalMaster(privateKey);

        UserKey userKey = UserKey.builder()
                .userId(userId)
                .keyVersion(1)
                .saltHex(HexFormat.of().formatHex(salt))
                .ivHex(HexFormat.of().formatHex(iv))
                .encryptedRecoveryKeyBase64(encryptedRecoveryKey)
                .encryptedPrivateKeyBase64(encryptedPrivateKey)
                .encryptedOperationalPrivateKeyBase64(wrappedOperational.ciphertextBase64())
                .operationalKeyId(wrappedOperational.keyId())
                .keyStatus(UserKey.KeyStatus.ACTIVE)
                .build();
        userKeyRepository.save(userKey);

        log.info("Key setup completed for user {} keyVersion={}", userId, userKey.getKeyVersion());
        return new KeySetupResult(Base64.getEncoder().encodeToString(recoveryKey), userKey.getKeyVersion());
    }

    /**
     * Derive private key from password (for verification or internal re-encrypt). Does not return key to client in API.
     */
    public byte[] derivePrivateKeyForUser(Long userId, String password) {
        UserKey userKey = userKeyRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalArgumentException("No key for user"));
        byte[] salt = HexFormat.of().parseHex(userKey.getSaltHex());
        return derivePrivateKey(password, salt);
    }

    /**
     * Verify password by deriving key and attempting to decrypt stored encrypted recovery key.
     */
    public boolean verifyPassword(Long userId, String password) {
        UserKey userKey = userKeyRepository.findByUserId(userId).orElse(null);
        if (userKey == null) return false;
        try {
            byte[] privateKey = derivePrivateKeyForUser(userId, password);
            byte[] iv = HexFormat.of().parseHex(userKey.getIvHex());
            decryptAesGcm(userKey.getEncryptedRecoveryKeyBase64(), privateKey, iv);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Revoke user key (admin or anomaly trigger). Optionally anchor revocation event to blockchain.
     * After revocation, if resetAfterRevoke is true, automatically reinitialize the key with new password.
     */
    @Transactional
    public void revokeKey(Long userId, String reason, String actorId, String ipAddress) {
        UserKey userKey = userKeyRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalArgumentException("No key for user"));
        if (userKey.getKeyStatus() == UserKey.KeyStatus.REVOKED) {
            log.warn("Key already revoked for user {}", userId);
            return;
        }

        userKey.setKeyStatus(UserKey.KeyStatus.REVOKED);
        userKey.setRevokedAt(java.time.LocalDateTime.now());
        userKey.setRevokedReason(reason);

        String blockchainTxHash = null;
        if (blockchainService != null && blockchainService.isEnabled()) {
            try {
                String payload = String.format("KEY_REVOKED|userId=%d|reason=%s|ts=%d",
                        userId, reason, System.currentTimeMillis());
                String hashHex = sha256Hex(payload.getBytes(StandardCharsets.UTF_8));
                blockchainTxHash = blockchainService.anchorSignature(hashHex);
                userKey.setRevokeBlockchainTxHash(blockchainTxHash);
            } catch (Exception e) {
                log.warn("Blockchain anchor for key revoke failed: {}", e.getMessage());
            }
        }
        userKeyRepository.save(userKey);
        // Force password reset - user must set new password; upon setting new password, key will be reinitialized
        forceUserPasswordReset(userId);

        Long actorUserId = null;
        try {
            if (actorId != null && !actorId.isBlank()) actorUserId = Long.parseLong(actorId);
        } catch (NumberFormatException ignored) {}
        auditService.logEvent(
                actorUserId,
                actorId != null && !actorId.isBlank() ? actorId : "SYSTEM",
                "KEY_REVOKED",
                "KEY_MANAGEMENT",
                "SUCCESS",
                String.format("Key revoked for user %d: %s%s", userId, reason,
                        blockchainTxHash != null ? " | blockchainTx=" + blockchainTxHash : ""),
                ipAddress,
                null,
                null
        );
        log.info("Key revoked for user {} reason={} blockchainTx={}", userId, reason, blockchainTxHash);
    }

    /**
     * Recover key using recovery key (user forgot password). Verifies recovery key, then creates new key version with new password.
     */
    @Transactional
    public KeySetupResult recoverKey(Long userId, String recoveryKeyBase64, String newPassword) {
        UserKey oldKey = userKeyRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalArgumentException("No key for user"));
        int oldVersion = oldKey.getKeyVersion();
        byte[] recoveryKey = Base64.getDecoder().decode(recoveryKeyBase64);
        if (recoveryKey.length != KEY_BYTES) {
            throw new IllegalArgumentException("Invalid recovery key length");
        }

        byte[] oldPrivateKey;
        try {
            byte[] iv = HexFormat.of().parseHex(oldKey.getIvHex());
            oldPrivateKey = decryptAesGcm(oldKey.getEncryptedPrivateKeyBase64(), recoveryKey, iv);
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid recovery key");
        }

        int newVersion = oldKey.getKeyVersion() + 1;
        byte[] salt = new byte[32];
        secureRandom.nextBytes(salt);
        byte[] iv = new byte[GCM_IV_BYTES];
        secureRandom.nextBytes(iv);
        byte[] newPrivateKey = derivePrivateKey(newPassword, salt);
        byte[] newRecoveryKey = new byte[KEY_BYTES];
        secureRandom.nextBytes(newRecoveryKey);

        String encryptedRecoveryKey = encryptAesGcm(newRecoveryKey, newPrivateKey, iv);
        String encryptedPrivateKey = encryptAesGcm(newPrivateKey, newRecoveryKey, iv);

        oldKey.setKeyVersion(newVersion);
        oldKey.setSaltHex(HexFormat.of().formatHex(salt));
        oldKey.setIvHex(HexFormat.of().formatHex(iv));
        oldKey.setEncryptedRecoveryKeyBase64(encryptedRecoveryKey);
        oldKey.setEncryptedPrivateKeyBase64(encryptedPrivateKey);
        WrappedOperationalKey wrappedRecovered = encryptWithOperationalMaster(newPrivateKey);
        oldKey.setEncryptedOperationalPrivateKeyBase64(wrappedRecovered.ciphertextBase64());
        oldKey.setOperationalKeyId(wrappedRecovered.keyId());
        oldKey.setKeyStatus(UserKey.KeyStatus.ACTIVE);
        oldKey.setRevokedAt(null);
        oldKey.setRevokedReason(null);
        oldKey.setRevokeBlockchainTxHash(null);
        userKeyRepository.save(oldKey);

        rewrapDocumentDeksForUser(userId, oldPrivateKey, newPrivateKey, oldVersion, newVersion);

        log.info("Key recovered for user {} newKeyVersion={}", userId, newVersion);
        return new KeySetupResult(Base64.getEncoder().encodeToString(newRecoveryKey), newVersion);
    }

    /**
     * Regenerate key (user has password). Creates new key version; caller should run batch re-encrypt job.
     */
    @Transactional
    public KeySetupResult regenerateKey(Long userId, String currentPassword, String newPassword) {
        byte[] oldPrivateKey = derivePrivateKeyForUser(userId, currentPassword);
        UserKey oldKey = userKeyRepository.findByUserId(userId).orElseThrow();
        int oldVersion = oldKey.getKeyVersion();

        int newVersion = oldKey.getKeyVersion() + 1;
        byte[] salt = new byte[32];
        secureRandom.nextBytes(salt);
        byte[] iv = new byte[GCM_IV_BYTES];
        secureRandom.nextBytes(iv);
        byte[] newPrivateKey = derivePrivateKey(newPassword, salt);
        byte[] newRecoveryKey = new byte[KEY_BYTES];
        secureRandom.nextBytes(newRecoveryKey);

        String encryptedRecoveryKey = encryptAesGcm(newRecoveryKey, newPrivateKey, iv);
        String encryptedPrivateKey = encryptAesGcm(newPrivateKey, newRecoveryKey, iv);

        oldKey.setKeyVersion(newVersion);
        oldKey.setSaltHex(HexFormat.of().formatHex(salt));
        oldKey.setIvHex(HexFormat.of().formatHex(iv));
        oldKey.setEncryptedRecoveryKeyBase64(encryptedRecoveryKey);
        oldKey.setEncryptedPrivateKeyBase64(encryptedPrivateKey);
        WrappedOperationalKey wrappedRegenerated = encryptWithOperationalMaster(newPrivateKey);
        oldKey.setEncryptedOperationalPrivateKeyBase64(wrappedRegenerated.ciphertextBase64());
        oldKey.setOperationalKeyId(wrappedRegenerated.keyId());
        oldKey.setKeyStatus(UserKey.KeyStatus.ACTIVE);
        oldKey.setRevokedAt(null);
        oldKey.setRevokedReason(null);
        oldKey.setRevokeBlockchainTxHash(null);
        userKeyRepository.save(oldKey);

        rewrapDocumentDeksForUser(userId, oldPrivateKey, newPrivateKey, oldVersion, newVersion);

        log.info("Key regenerated for user {} newKeyVersion={}", userId, newVersion);
        return new KeySetupResult(Base64.getEncoder().encodeToString(newRecoveryKey), newVersion);
    }

    public KeyStatusResponse getKeyStatus(Long userId) {
        UserKey userKey = userKeyRepository.findByUserId(userId).orElse(null);
        if (userKey == null) {
            return new KeyStatusResponse(null, null, null, null, null, false, getMode(), isSelfServiceRecoveryEnabled());
        }
        return new KeyStatusResponse(
                userKey.getKeyVersion(),
                userKey.getKeyStatus().name(),
                userKey.getCreatedAt(),
                userKey.getRevokedAt(),
                userKey.getRevokedReason(),
                userKey.getRevokeBlockchainTxHash() != null,
                getMode(),
                isSelfServiceRecoveryEnabled()
        );
    }

    public boolean hasKey(Long userId) {
        return userKeyRepository.existsByUserId(userId);
    }

    public boolean isKeyActive(Long userId) {
        UserKey userKey = userKeyRepository.findByUserId(userId).orElse(null);
        return userKey != null && userKey.getKeyStatus() == UserKey.KeyStatus.ACTIVE;
    }

    /**
     * Enterprise escrow mode helper:
     * ensure a user has an active key right after password setup/change.
     * Returns true if a new key was created.
     */
    @Transactional
    public boolean ensureKeyExistsAfterPasswordChange(Long userId, String currentPassword) {
        if (!keyManagementEnabled) return false;
        if (userId == null || currentPassword == null || currentPassword.isBlank()) return false;
        if (hasKey(userId) && isKeyActive(userId)) return false;
        setupKey(userId, currentPassword);
        return true;
    }

    @Transactional
    public OperationalRewrapResult rewrapOperationalKeysToActiveKey() {
        String targetKeyId = resolveActiveOperationalKeyId();
        List<UserKey> all = userKeyRepository.findAll();
        int processed = 0;
        int skipped = 0;
        int failed = 0;

        for (UserKey userKey : all) {
            try {
                if (userKey.getEncryptedOperationalPrivateKeyBase64() == null || userKey.getEncryptedOperationalPrivateKeyBase64().isBlank()) {
                    skipped++;
                    continue;
                }
                String currentKeyId = userKey.getOperationalKeyId();
                if (targetKeyId.equals(currentKeyId)) {
                    skipped++;
                    continue;
                }
                byte[] privateKey = decryptWithOperationalMaster(userKey.getEncryptedOperationalPrivateKeyBase64(), currentKeyId);
                WrappedOperationalKey wrapped = encryptWithOperationalMaster(privateKey);
                userKey.setEncryptedOperationalPrivateKeyBase64(wrapped.ciphertextBase64());
                userKey.setOperationalKeyId(wrapped.keyId());
                userKeyRepository.save(userKey);
                processed++;
            } catch (Exception e) {
                failed++;
                log.error("Failed rewrapping operational key for user {}", userKey.getUserId(), e);
            }
        }
        return new OperationalRewrapResult(targetKeyId, processed, skipped, failed);
    }

    public int getCurrentKeyVersion(Long userId) {
        UserKey userKey = userKeyRepository.findByUserId(userId)
            .orElseThrow(() -> new IllegalArgumentException("No key for user"));
        return userKey.getKeyVersion();
    }

    public byte[] getOperationalPrivateKey(Long userId) {
        UserKey userKey = userKeyRepository.findByUserId(userId)
            .orElseThrow(() -> new IllegalArgumentException("No key for user"));
        if (userKey.getKeyStatus() != UserKey.KeyStatus.ACTIVE) {
            throw new IllegalStateException("User key is not active");
        }
        if (userKey.getEncryptedOperationalPrivateKeyBase64() == null || userKey.getEncryptedOperationalPrivateKeyBase64().isBlank()) {
            throw new IllegalStateException("Operational key material not initialized for user");
        }
        return decryptWithOperationalMaster(
            userKey.getEncryptedOperationalPrivateKeyBase64(),
            userKey.getOperationalKeyId()
        );
    }

    private byte[] derivePrivateKey(String password, byte[] salt) {
        try {
            PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, pbkdf2Iterations, KEY_BYTES * 8);
            SecretKeyFactory factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
            byte[] key = factory.generateSecret(spec).getEncoded();
            spec.clearPassword();
            return key;
        } catch (Exception e) {
            throw new RuntimeException("Key derivation failed", e);
        }
    }

    private static final String AES_GCM = "AES/GCM/NoPadding";

    private String encryptAesGcm(byte[] plaintext, byte[] keyBytes, byte[] iv) {
        try {
            SecretKey key = new SecretKeySpec(keyBytes, "AES");
            Cipher cipher = Cipher.getInstance(AES_GCM);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] ct = cipher.doFinal(plaintext);
            byte[] packed = new byte[iv.length + ct.length];
            System.arraycopy(iv, 0, packed, 0, iv.length);
            System.arraycopy(ct, 0, packed, iv.length, ct.length);
            return Base64.getEncoder().encodeToString(packed);
        } catch (Exception e) {
            throw new RuntimeException("Encrypt failed", e);
        }
    }

    private byte[] decryptAesGcm(String ciphertextBase64, byte[] keyBytes, byte[] iv) {
        try {
            byte[] packed = Base64.getDecoder().decode(ciphertextBase64);
            byte[] ct = new byte[packed.length - iv.length];
            System.arraycopy(packed, iv.length, ct, 0, ct.length);
            SecretKey key = new SecretKeySpec(keyBytes, "AES");
            Cipher cipher = Cipher.getInstance(AES_GCM);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
            return cipher.doFinal(ct);
        } catch (Exception e) {
            throw new RuntimeException("Decrypt failed", e);
        }
    }

    private String sha256Hex(byte[] data) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(data));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private WrappedOperationalKey encryptWithOperationalMaster(byte[] plaintext) {
        String activeKeyId = resolveActiveOperationalKeyId();
        byte[] master = deriveOperationalMasterKey(activeKeyId);
        byte[] iv = new byte[GCM_IV_BYTES];
        secureRandom.nextBytes(iv);
        return new WrappedOperationalKey(activeKeyId, encryptAesGcm(plaintext, master, iv));
    }

    private byte[] decryptWithOperationalMaster(String ciphertextBase64, String keyId) {
        String effectiveKeyId = (keyId == null || keyId.isBlank()) ? resolveActiveOperationalKeyId() : keyId;
        byte[] master = deriveOperationalMasterKey(effectiveKeyId);
        byte[] packed = Base64.getDecoder().decode(ciphertextBase64);
        if (packed.length <= GCM_IV_BYTES) {
            throw new IllegalArgumentException("Invalid operational ciphertext");
        }
        byte[] iv = new byte[GCM_IV_BYTES];
        System.arraycopy(packed, 0, iv, 0, iv.length);
        return decryptAesGcm(ciphertextBase64, master, iv);
    }

    private String resolveActiveOperationalKeyId() {
        if (operationalActiveKeyId != null && !operationalActiveKeyId.isBlank()) {
            return operationalActiveKeyId.trim();
        }
        return "v1";
    }

    private byte[] deriveOperationalMasterKey(String keyId) {
        String secret = resolveOperationalSecretByKeyId(keyId);
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return md.digest(secret.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new RuntimeException("Failed to derive operational master key", e);
        }
    }

    private String resolveOperationalSecretByKeyId(String keyId) {
        String requested = keyId == null ? "" : keyId.trim();
        if (operationalKeyringRaw != null && !operationalKeyringRaw.isBlank()) {
            String[] entries = operationalKeyringRaw.split(";");
            for (String entry : entries) {
                if (entry == null || entry.isBlank() || !entry.contains("=")) continue;
                String[] kv = entry.split("=", 2);
                String k = kv[0].trim();
                String v = kv[1].trim();
                if (!k.isBlank() && k.equals(requested) && !v.isBlank()) {
                    return v;
                }
            }
        }
        if (requested.equals(resolveActiveOperationalKeyId()) && legacyOperationalMasterSecret != null && !legacyOperationalMasterSecret.isBlank()) {
            return legacyOperationalMasterSecret;
        }
        throw new IllegalStateException("Operational key secret not found for keyId=" + requested);
    }

    private void rewrapDocumentDeksForUser(Long userId, byte[] oldPrivateKey, byte[] newPrivateKey, int oldVersion, int newVersion) {
        KeyRecoveryJob job = KeyRecoveryJob.builder()
            .userId(userId)
            .status(KeyRecoveryJob.JobStatus.RUNNING)
            .totalDocs(0)
            .processedDocs(0)
            .failedDocs(0)
            .build();
        job = keyRecoveryJobRepository.save(job);

        int processed = 0;
        int failed = 0;
        List<DocumentKey> keys = documentKeyRepository.findByOwnerUserId(userId);
        job.setTotalDocs(keys.size());
        keyRecoveryJobRepository.save(job);

        for (DocumentKey key : keys) {
            try {
                if (key.getKeyVersion() == null || key.getKeyVersion() != oldVersion) {
                    continue;
                }
                byte[] dek = decryptAesGcmBase64Packed(key.getEncryptedDekBase64(), oldPrivateKey);
                String rewrapped = encryptAesGcmBase64Packed(dek, newPrivateKey);
                key.setEncryptedDekBase64(rewrapped);
                key.setKeyVersion(newVersion);
                documentKeyRepository.save(key);
                processed++;
            } catch (Exception e) {
                failed++;
                log.error("Failed to rewrap DEK for document {} user {}", key.getDocumentId(), userId, e);
            }
        }

        job.setProcessedDocs(processed);
        job.setFailedDocs(failed);
        job.setStatus(failed == 0 ? KeyRecoveryJob.JobStatus.COMPLETED : KeyRecoveryJob.JobStatus.FAILED);
        job.setCompletedAt(java.time.LocalDateTime.now());
        if (failed > 0) {
            job.setErrorMessage("Some document keys failed to rewrap");
        }
        keyRecoveryJobRepository.save(job);
    }

    private String encryptAesGcmBase64Packed(byte[] plaintext, byte[] keyBytes) {
        byte[] iv = new byte[GCM_IV_BYTES];
        secureRandom.nextBytes(iv);
        return encryptAesGcm(plaintext, keyBytes, iv);
    }

    private byte[] decryptAesGcmBase64Packed(String ciphertextBase64, byte[] keyBytes) {
        byte[] packed = Base64.getDecoder().decode(ciphertextBase64);
        if (packed.length <= GCM_IV_BYTES) {
            throw new IllegalArgumentException("Invalid ciphertext");
        }
        byte[] iv = new byte[GCM_IV_BYTES];
        System.arraycopy(packed, 0, iv, 0, iv.length);
        return decryptAesGcm(ciphertextBase64, keyBytes, iv);
    }

    private void forceUserPasswordReset(Long userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return;
        }
        user.setPasswordChangeRequired(true);
        user.setPasswordExpiryDate(java.time.LocalDateTime.now());
        user.setTokenVersion((user.getTokenVersion() == null ? 1 : user.getTokenVersion()) + 1);
        userRepository.save(user);
    }

    private record WrappedOperationalKey(String keyId, String ciphertextBase64) {}

    public record KeySetupResult(String recoveryKeyBase64, int keyVersion) {}
    public record OperationalRewrapResult(String targetKeyId, int processed, int skipped, int failed) {}
    public record KeyStatusResponse(Integer keyVersion, String status, java.time.LocalDateTime createdAt,
                                    java.time.LocalDateTime revokedAt, String revokedReason, boolean revokeAnchoredToBlockchain,
                                    String mode, boolean selfServiceRecoveryEnabled) {}
}
