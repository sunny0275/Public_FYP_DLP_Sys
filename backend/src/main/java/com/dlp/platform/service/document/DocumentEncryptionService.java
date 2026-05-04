package com.dlp.platform.service.document;

import com.dlp.platform.entity.Document;
import com.dlp.platform.entity.DocumentKey;
import com.dlp.platform.repository.DocumentKeyRepository;
import com.dlp.platform.repository.DocumentRepository;
import com.dlp.platform.service.key.KeyManagementService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.security.SecureRandom;
import java.util.Base64;

@Service
@Slf4j
@RequiredArgsConstructor
public class DocumentEncryptionService {

    private static final int KEY_BYTES = 32;
    private static final int GCM_IV_BYTES = 12;
    private static final int GCM_TAG_BITS = 128;
    private static final String AES_GCM = "AES/GCM/NoPadding";

    private final FileStorageService fileStorageService;
    private final DocumentKeyRepository documentKeyRepository;
    private final DocumentRepository documentRepository;
    private final KeyManagementService keyManagementService;

    private final SecureRandom secureRandom = new SecureRandom();

    @Transactional
    public void encryptDocumentAtRest(Document document) throws IOException {
        if (document == null || document.getId() == null) {
            throw new IllegalArgumentException("Document must be persisted before encryption");
        }
        if (Boolean.TRUE.equals(document.getEncrypted()) && documentKeyRepository.findByDocumentId(document.getId()).isPresent()) {
            return;
        }
        if (document.getOwner() == null || document.getOwner().getId() == null) {
            throw new IllegalArgumentException("Document owner is required for encryption");
        }

        byte[] plaintext = fileStorageService.readFile(document.getFilePath());
        byte[] dek = randomBytes(KEY_BYTES);
        byte[] encryptedBytes = encryptBytes(plaintext, dek);

        String originalPath = document.getFilePath();
        String encryptedPath = fileStorageService.storeFileFromBytes(
            encryptedBytes,
            document.getDepartment(),
            document.getFileName()
        );

        byte[] ownerOperationalKey = keyManagementService.getOperationalPrivateKey(document.getOwner().getId());
        String encryptedDekBase64 = encryptToBase64(dek, ownerOperationalKey);

        DocumentKey documentKey = documentKeyRepository.findByDocumentId(document.getId())
            .orElseGet(DocumentKey::new);
        documentKey.setDocumentId(document.getId());
        documentKey.setOwnerUserId(document.getOwner().getId());
        documentKey.setKeyVersion(keyManagementService.getCurrentKeyVersion(document.getOwner().getId()));
        documentKey.setEncryptedDekBase64(encryptedDekBase64);
        documentKeyRepository.save(documentKey);

        document.setFilePath(encryptedPath);
        document.setFileSize((long) encryptedBytes.length);
        document.setEncrypted(true);
        // placeholder until ID is available after save
        document.setEncryptionKeyId("document-key");
        documentRepository.save(document);

        // fill encryptionKeyId with persisted key id for traceability
        document.setEncryptionKeyId(documentKey.getId() != null ? String.valueOf(documentKey.getId()) : "document-key");
        documentRepository.save(document);

        try {
            fileStorageService.deleteFile(originalPath);
        } catch (Exception e) {
            log.warn("Failed to delete original unencrypted file for document {}: {}", document.getId(), e.getMessage());
        }

        log.info("Document encrypted at rest: documentId={}, keyVersion={}", document.getId(), documentKey.getKeyVersion());
    }

    @Transactional
    public void reEncryptDocumentAtRest(Document document) throws IOException {
        if (document == null || document.getId() == null) {
            throw new IllegalArgumentException("Document must be persisted before re-encryption");
        }
        if (document.getOwner() == null || document.getOwner().getId() == null) {
            throw new IllegalArgumentException("Document owner is required for re-encryption");
        }

        byte[] plaintext = readDecryptedDocumentContent(document);
        byte[] dek = randomBytes(KEY_BYTES);
        byte[] encryptedBytes = encryptBytes(plaintext, dek);

        String oldPath = document.getFilePath();
        String encryptedPath = fileStorageService.storeFileFromBytes(
            encryptedBytes,
            document.getDepartment(),
            document.getFileName()
        );

        byte[] ownerOperationalKey = keyManagementService.getOperationalPrivateKey(document.getOwner().getId());
        String encryptedDekBase64 = encryptToBase64(dek, ownerOperationalKey);

        DocumentKey documentKey = documentKeyRepository.findByDocumentId(document.getId()).orElseGet(DocumentKey::new);
        documentKey.setDocumentId(document.getId());
        documentKey.setOwnerUserId(document.getOwner().getId());
        documentKey.setKeyVersion(keyManagementService.getCurrentKeyVersion(document.getOwner().getId()));
        documentKey.setEncryptedDekBase64(encryptedDekBase64);
        documentKeyRepository.save(documentKey);

        document.setFilePath(encryptedPath);
        document.setFileSize((long) encryptedBytes.length);
        document.setEncrypted(true);
        document.setEncryptionKeyId(documentKey.getId() != null ? String.valueOf(documentKey.getId()) : "document-key");
        documentRepository.save(document);

        try {
            fileStorageService.deleteFile(oldPath);
        } catch (Exception e) {
            log.warn("Failed to delete old encrypted file for document {}: {}", document.getId(), e.getMessage());
        }

        log.info("Document re-encrypted at rest: documentId={}, keyVersion={}", document.getId(), documentKey.getKeyVersion());
    }

    @Transactional(readOnly = true)
    public byte[] readDecryptedDocumentContent(Document document) throws IOException {
        if (document == null || document.getId() == null) {
            throw new IllegalArgumentException("Document is required");
        }
        byte[] stored = fileStorageService.readFile(document.getFilePath());
        if (!Boolean.TRUE.equals(document.getEncrypted())) {
            return stored;
        }

        DocumentKey key = documentKeyRepository.findByDocumentId(document.getId()).orElse(null);
        if (key == null) {
            log.warn("Encrypted flag set but no document key found for document {}, returning stored bytes for backward compatibility", document.getId());
            return stored;
        }
        byte[] ownerOperationalKey = keyManagementService.getOperationalPrivateKey(key.getOwnerUserId());
        byte[] dek = decryptFromBase64(key.getEncryptedDekBase64(), ownerOperationalKey);
        return decryptBytes(stored, dek);
    }

    private byte[] randomBytes(int size) {
        byte[] out = new byte[size];
        secureRandom.nextBytes(out);
        return out;
    }

    private byte[] encryptBytes(byte[] plaintext, byte[] keyBytes) {
        try {
            byte[] iv = randomBytes(GCM_IV_BYTES);
            Cipher cipher = Cipher.getInstance(AES_GCM);
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(keyBytes, "AES"), new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] ct = cipher.doFinal(plaintext);
            byte[] packed = new byte[iv.length + ct.length];
            System.arraycopy(iv, 0, packed, 0, iv.length);
            System.arraycopy(ct, 0, packed, iv.length, ct.length);
            return packed;
        } catch (Exception e) {
            throw new RuntimeException("Document content encryption failed", e);
        }
    }

    private byte[] decryptBytes(byte[] packedCiphertext, byte[] keyBytes) {
        try {
            if (packedCiphertext.length <= GCM_IV_BYTES) {
                throw new IllegalArgumentException("Ciphertext too short");
            }
            byte[] iv = new byte[GCM_IV_BYTES];
            System.arraycopy(packedCiphertext, 0, iv, 0, iv.length);
            byte[] ct = new byte[packedCiphertext.length - iv.length];
            System.arraycopy(packedCiphertext, iv.length, ct, 0, ct.length);
            Cipher cipher = Cipher.getInstance(AES_GCM);
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(keyBytes, "AES"), new GCMParameterSpec(GCM_TAG_BITS, iv));
            return cipher.doFinal(ct);
        } catch (Exception e) {
            throw new RuntimeException("Document content decryption failed", e);
        }
    }

    private String encryptToBase64(byte[] plaintext, byte[] keyBytes) {
        return Base64.getEncoder().encodeToString(encryptBytes(plaintext, keyBytes));
    }

    private byte[] decryptFromBase64(String ciphertextBase64, byte[] keyBytes) {
        byte[] packed = Base64.getDecoder().decode(ciphertextBase64);
        return decryptBytes(packed, keyBytes);
    }
}

