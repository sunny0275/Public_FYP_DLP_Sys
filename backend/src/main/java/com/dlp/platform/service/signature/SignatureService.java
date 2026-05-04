package com.dlp.platform.service.signature;

import com.dlp.platform.entity.Document;
import com.dlp.platform.entity.SignatureRecord;
import com.dlp.platform.entity.User;
import com.dlp.platform.entity.UserCertificate;
import com.dlp.platform.repository.DocumentRepository;
import com.dlp.platform.service.BlockchainService;
import com.dlp.platform.service.audit.AuditLogService;
import com.dlp.platform.service.pki.PkiService;
import com.dlp.platform.repository.SignatureRepository;
import com.dlp.platform.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.jce.ECNamedCurveTable;
import org.bouncycastle.jce.spec.ECNamedCurveParameterSpec;
import org.bouncycastle.jce.spec.ECPrivateKeySpec;
import org.bouncycastle.jce.spec.ECPublicKeySpec;
import org.bouncycastle.math.ec.ECPoint;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.*;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.math.BigInteger;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Service for managing electronic signatures using ECDSA
 *
 * Implementation:
 * - ECDSA with secp256k1 curve (Ethereum-compatible)
 * - SHA-256 hash algorithm
 * - RFC 3161 timestamping via TimestampService
 * - Optional blockchain anchoring via BlockchainService
 * - Signature chain tracking for documents
 *
 * Security:
 * - Supports server-managed per-user signing keys (encrypted at rest) for non-interactive signing
 * - Supports legacy client-provided privateKeyHex for manual/demo flows
 * - Comprehensive audit logging
 * - Signature verification on retrieval
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class SignatureService {

    private final SignatureRepository signatureRepository;
    private final DocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final UserSigningKeyService userSigningKeyService;
    private final TimestampService timestampService;
    private final AuditLogService auditLogService;
    private final BlockchainService blockchainService;
    private final PkiService pkiService;

    static {
        // Register Bouncy Castle security provider
        Security.addProvider(new BouncyCastleProvider());
    }

    /**
     * Sign a document with ECDSA signature
     *
     * @param documentId Document to sign
     * @param documentHash SHA-256 hash of document content
     * @param userId User signing the document
     * @param privateKeyHex User's private key (derived from password, not stored)
     * @param ipAddress IP address of signer
     * @param deviceFingerprint Device fingerprint
     * @param mfaCode MFA verification code (must be verified before calling)
     * @return Signature record
     * @throws IllegalStateException if blockchain anchoring or signature fails
     */
    @Transactional
    public SignatureRecord signDocument(
            Long documentId,
            String documentHash,
            Long userId,
            String privateKeyHex,
            String ipAddress,
            String deviceFingerprint,
            String mfaCode
    ) throws Exception {
        return signDocument(documentId, documentHash, userId, privateKeyHex, ipAddress, deviceFingerprint, mfaCode, null, null);
    }

    /**
     * Sign a document with ECDSA signature (extended version with action type and description)
     */
    @Transactional
    public SignatureRecord signDocument(
            Long documentId,
            String documentHash,
            Long userId,
            String privateKeyHex,
            String ipAddress,
            String deviceFingerprint,
            String mfaCode,
            String actionType,
            String description
    ) throws Exception {
        log.info("Signing document {} for user {}", documentId, userId);

        // Verify document exists
        Document document = documentRepository.findById(documentId)
            .orElseThrow(() -> new EntityNotFoundException("Document not found"));

        // Verify user exists
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new EntityNotFoundException("User not found"));

        // Check if user has already signed this document with the same action type
        // Different action types (e.g., share approvals) allow multiple signatures
        List<SignatureRecord> existingSigs = signatureRepository.findByDocumentIdAndUserId(documentId, userId);
        boolean alreadySignedSameAction = existingSigs.stream()
            .anyMatch(s -> s.getStatus() == SignatureRecord.SignatureStatus.VALID 
                        && actionType != null && actionType.equals(s.getSignatureType()));
        
        if (alreadySignedSameAction) {
            throw new IllegalStateException("User has already signed this document with action type: " + actionType);
        }

        // Resolve private key:
        // - If client provided privateKeyHex, use it (legacy/manual signing flow)
        // - Otherwise rotate/generate a fresh server-managed per-user signing key immediately
        //   (requested: no password/MFA prompt, and always generate a new per-user key on server-key path).
        PrivateKey privateKey = (privateKeyHex != null && !privateKeyHex.isBlank())
            ? loadPrivateKeyFromHex(privateKeyHex)
            : userSigningKeyService.rotateSigningKey(user);
        PublicKey publicKey = derivePublicKey(privateKey);

        // Issue (or reuse) X.509 signer certificate for PKI chain display + verification
        UserCertificate signerCertRecord = null;
        String signerCertPem = null;
        String issuerCertPem = null;
        String certSerialHex = null;
        if (pkiService != null && pkiService.isEnabled()) {
            signerCertRecord = pkiService.issueOrReuseUserCertificate(userId, publicKey);
            signerCertPem = signerCertRecord.getCertificatePem();
            issuerCertPem = pkiService.getCaCertificatePem();
            certSerialHex = signerCertRecord.getSerialHex();
        }

        // Sign document hash using ECDSA
        Signature ecdsaSignature = Signature.getInstance("SHA256withECDSA", "BC");
        ecdsaSignature.initSign(privateKey);
        ecdsaSignature.update(normalizeDocumentHashBytes(documentHash));
        byte[] signatureBytes = ecdsaSignature.sign();
        String signatureHex = bytesToHex(signatureBytes);

        log.debug("ECDSA signature generated: {} bytes", signatureBytes.length);

        // Request RFC 3161 timestamp from TSA
        String timestampToken;
        try {
            timestampToken = timestampService.requestTimestamp(documentHash);
            log.info("RFC 3161 timestamp received");
        } catch (Exception e) {
            log.error("Failed to obtain timestamp", e);
            throw new IllegalStateException(
                "Failed to obtain cryptographic timestamp. Please try again. " +
                "If the problem persists, contact your system administrator.", e);
        }

        // Block 1: Sign FIRST, then anchor to blockchain
        // Block 2: If blockchain anchoring fails, the ENTIRE operation is rolled back
        //         and user must retry the signing action
        String blockchainTxHash = null;
        boolean blockchainAnchored = false;
        
        try {
            if (blockchainService != null && blockchainService.isEnabled()) {
                // Hash the signature for blockchain anchoring
                String signatureHashForChain = hashSHA256(signatureHex);
                blockchainTxHash = blockchainService.anchorSignature(signatureHashForChain);
                blockchainAnchored = true;
                log.info("Signature anchored to blockchain: {}", blockchainTxHash);
            }
        } catch (Exception e) {
            // CRITICAL: Blockchain anchoring failed
            // The signature WAS created but cannot be anchored - operation must FAIL
            // DO NOT save the signature record - this forces user to retry
            log.error("BLOCKCHAIN ANCHORING FAILED for document {} - Operation rolled back. User must retry.", documentId, e);
            
            auditLogService.log(
                userId,
                "BLOCKCHAIN_ANCHOR_FAILED",
                "Signature",
                documentId.toString(),
                ipAddress,
                String.format("BLOCKCHAIN ANCHOR FAILED for document %d: %s. Signature NOT saved - user must retry.",
                    documentId, e.getMessage())
            );
            
            // Throw specific exception to indicate user should retry
            throw new IllegalStateException(
                "Blockchain anchoring failed. Please try signing the document again. " +
                "If this error persists, please contact your system administrator.", e);
        }

        // Only reached this point if blockchain anchoring succeeded
        if (blockchainAnchored) {
            auditLogService.log(
                userId,
                "BLOCKCHAIN_ANCHOR_SUCCESS",
                "Signature",
                documentId.toString(),
                ipAddress,
                String.format("Blockchain anchor success for document %d, txHash=%s", documentId, blockchainTxHash)
            );
        }

        // Create signature record ONLY after all verifications passed
        SignatureRecord record = SignatureRecord.builder()
            .documentId(documentId)
            .userId(userId)
            .signatureHex(signatureHex)
            .publicKeyHex(bytesToHex(publicKey.getEncoded()))
            .certificatePem(signerCertPem)
            .issuerCertificatePem(issuerCertPem)
            .certificateSerialHex(certSerialHex)
            .documentHash(documentHash)
            .timestampToken(timestampToken)
            .blockchainTxHash(blockchainTxHash)
            .signedAt(LocalDateTime.now())
            .ipAddress(ipAddress)
            .deviceFingerprint(deviceFingerprint)
            .mfaVerificationCode(mfaCode)
            .signatureType(actionType)
            .status(SignatureRecord.SignatureStatus.VALID)
            .build();

        SignatureRecord savedRecord = signatureRepository.save(record);

        // Audit log
        auditLogService.log(
            userId,
            "DOCUMENT_SIGNED",
            "Document",
            documentId.toString(),
            ipAddress,
            String.format(
                "Document signed: %s (Signature ID: %d, Signer: %s, Dept: %s)",
                document.getName(),
                savedRecord.getId(),
                user.getFullName(),
                user.getDepartment()
            )
        );

        log.info("Document signature created: ID={}, DocumentID={}, UserID={}, BlockchainTxHash={}",
            savedRecord.getId(), documentId, userId, blockchainTxHash);

        return savedRecord;
    }

    /**
     * Auto-sign a document on behalf of a user (non-interactive).
     * Idempotent: if already signed by this user, it returns null.
     */
    @Transactional
    public SignatureRecord autoSignIfNeeded(
        Long documentId,
        String documentHash,
        Long userId,
        String ipAddress,
        String deviceFingerprint,
        String actionType
    ) {
        // Check if user has already signed this document with the same action type
        List<SignatureRecord> existingSigs = signatureRepository.findByDocumentIdAndUserId(documentId, userId);
        boolean alreadySignedSameAction = existingSigs.stream()
            .anyMatch(s -> s.getStatus() == SignatureRecord.SignatureStatus.VALID 
                        && actionType != null && actionType.equals(s.getSignatureType()));
        if (alreadySignedSameAction) return null;

        try {
            return signDocument(
                documentId,
                documentHash,
                userId,
                null, // use server-managed key
                ipAddress,
                deviceFingerprint,
                null,  // no interactive MFA code
                actionType,
                null   // no description
            );
        } catch (IllegalStateException e) {
            // race: another request signed just before us
            return null;
        } catch (Exception e) {
            throw new RuntimeException("Auto-sign failed: " + e.getMessage(), e);
        }
    }

    /**
     * Verify a signature's authenticity
     *
     * @param signatureId Signature record ID
     * @return true if signature is valid, false otherwise
     */
    @Transactional(readOnly = true)
    public boolean verifySignature(Long signatureId) throws Exception {
        log.info("Verifying signature: {}", signatureId);

        SignatureRecord record = signatureRepository.findById(signatureId)
            .orElseThrow(() -> new EntityNotFoundException("Signature not found"));

        // Check if signature is already marked as invalid or revoked
        if (record.getStatus() == SignatureRecord.SignatureStatus.INVALID ||
            record.getStatus() == SignatureRecord.SignatureStatus.REVOKED) {
            log.warn("Signature {} is {}", signatureId, record.getStatus());
            return false;
        }

        // Verify ECDSA signature using stored public key
        if (record.getPublicKeyHex() == null || record.getPublicKeyHex().isBlank()) {
            log.error("Missing public key for signature {}", signatureId);
            return false;
        }

        PublicKey publicKey = loadPublicKey(hexToBytes(record.getPublicKeyHex()));
        Signature ecdsaSignature = Signature.getInstance("SHA256withECDSA", "BC");
        ecdsaSignature.initVerify(publicKey);
        ecdsaSignature.update(normalizeDocumentHashBytes(record.getDocumentHash()));
        boolean signatureValid = ecdsaSignature.verify(hexToBytes(record.getSignatureHex()));

        if (!signatureValid) {
            log.error("ECDSA signature verification failed for signature {}", signatureId);
            return false;
        }

        // Verify RFC 3161 timestamp token
        boolean timestampValid = timestampService.verifyTimestamp(
            record.getTimestampToken(),
            record.getDocumentHash()
        );

        if (!timestampValid) {
            log.error("Timestamp verification failed for signature {}", signatureId);
            return false;
        }

        if (record.getBlockchainTxHash() != null) {
            boolean blockchainValid = blockchainService != null && blockchainService.verifyAnchor(
                record.getBlockchainTxHash(),
                hashSHA256(record.getSignatureHex())
            );

            if (!blockchainValid) {
                log.error("Blockchain verification failed for signature {}", signatureId);
                auditLogService.log(
                    record.getUserId(),
                    "BLOCKCHAIN_VERIFY_FAILED",
                    "Signature",
                    signatureId.toString(),
                    record.getIpAddress(),
                    String.format("Blockchain verification failed, txHash=%s", record.getBlockchainTxHash())
                );
                return false;
            }

            auditLogService.log(
                record.getUserId(),
                "BLOCKCHAIN_VERIFY_SUCCESS",
                "Signature",
                signatureId.toString(),
                record.getIpAddress(),
                String.format("Blockchain verification success, txHash=%s", record.getBlockchainTxHash())
            );
        }

        // Verify PKI certificate chain + revocation status (CRL/OCSP)
        if (pkiService != null && pkiService.isEnabled()) {
            if (record.getCertificatePem() == null || record.getCertificatePem().isBlank()) {
                log.error("Missing certificatePem for signature {}", signatureId);
                return false;
            }
            java.security.cert.CertificateFactory cf = java.security.cert.CertificateFactory.getInstance("X.509");
            java.security.cert.X509Certificate leafCert = (java.security.cert.X509Certificate) cf.generateCertificate(
                new java.io.ByteArrayInputStream(record.getCertificatePem().getBytes(java.nio.charset.StandardCharsets.UTF_8))
            );

            PkiService.PkiVerifyResult pkiRes = pkiService.verifyCertificateChainAndStatus(leafCert);
            if (pkiRes.getStatus() != PkiService.PkiVerifyResult.Status.GOOD) {
                log.error("PKI certificate verification failed for signature {}: {} - {}", signatureId, pkiRes.getStatus(), pkiRes.getMessage());
                return false;
            }
        }

        log.info("Signature {} verified successfully", signatureId);
        return true;
    }

    /**
     * Get signature chain for a document
     * Returns all signatures in chronological order
     *
     * @param documentId Document ID
     * @return List of signature records
     */
    @Transactional(readOnly = true)
    public List<SignatureRecord> getSignatureChain(Long documentId) {
        log.debug("Retrieving signature chain for document {}", documentId);

        // Verify document exists
        if (!documentRepository.existsById(documentId)) {
            throw new EntityNotFoundException("Document not found");
        }

        List<SignatureRecord> chain = signatureRepository.findByDocumentIdOrderBySignedAtAsc(documentId);

        log.info("Signature chain retrieved: {} signatures for document {}", chain.size(), documentId);
        return chain;
    }

    /**
     * Check if a user has signed a document
     */
    @Transactional(readOnly = true)
    public boolean hasUserSignedDocument(Long documentId, Long userId) {
        return signatureRepository.existsByDocumentIdAndUserIdAndStatus(
            documentId, userId, SignatureRecord.SignatureStatus.VALID);
    }

    /**
     * Get signature statistics for a document
     */
    @Transactional(readOnly = true)
    public SignatureStats getDocumentSignatureStats(Long documentId) {
        long totalSignatures = signatureRepository.countByDocumentId(documentId);
        long validSignatures = signatureRepository.countValidSignaturesByDocument(documentId);

        return new SignatureStats(totalSignatures, validSignatures);
    }

    // Helper methods

    private PrivateKey loadPrivateKey(byte[] keyBytes) throws Exception {
        KeyFactory keyFactory = KeyFactory.getInstance("EC", "BC");
        PKCS8EncodedKeySpec keySpec = new PKCS8EncodedKeySpec(keyBytes);
        return keyFactory.generatePrivate(keySpec);
    }

    private PrivateKey loadPrivateKeyFromHex(String privateKeyHex) throws Exception {
        if (privateKeyHex == null || privateKeyHex.isBlank()) {
            throw new IllegalArgumentException("privateKeyHex is required");
        }

        String normalized = privateKeyHex.trim();
        // If user provided raw 32-byte scalar (common for derived keys), build EC key from secp256k1 params.
        if (normalized.length() == 64) {
            return loadSecp256k1PrivateKeyFromScalar(hexToBytes(normalized));
        }

        // Otherwise assume hex-encoded PKCS#8 DER bytes.
        return loadPrivateKey(hexToBytes(normalized));
    }

    private PrivateKey loadSecp256k1PrivateKeyFromScalar(byte[] scalar32) throws Exception {
        if (scalar32.length != 32) {
            throw new IllegalArgumentException("Expected 32-byte private key scalar");
        }
        ECNamedCurveParameterSpec ecSpec = ECNamedCurveTable.getParameterSpec("secp256k1");
        BigInteger d = new BigInteger(1, scalar32);
        KeyFactory kf = KeyFactory.getInstance("EC", "BC");
        return kf.generatePrivate(new ECPrivateKeySpec(d, ecSpec));
    }

    private PublicKey derivePublicKey(PrivateKey privateKey) throws Exception {
        if (!(privateKey instanceof java.security.interfaces.ECPrivateKey ecPriv)) {
            throw new IllegalArgumentException("Unsupported private key type: " + privateKey.getClass());
        }
        ECNamedCurveParameterSpec ecSpec = ECNamedCurveTable.getParameterSpec("secp256k1");
        BigInteger d = ecPriv.getS();
        ECPoint q = ecSpec.getG().multiply(d).normalize();
        KeyFactory kf = KeyFactory.getInstance("EC", "BC");
        return kf.generatePublic(new ECPublicKeySpec(q, ecSpec));
    }

    private PublicKey loadPublicKey(byte[] keyBytes) throws Exception {
        KeyFactory keyFactory = KeyFactory.getInstance("EC", "BC");
        X509EncodedKeySpec keySpec = new X509EncodedKeySpec(keyBytes);
        return keyFactory.generatePublic(keySpec);
    }

    private byte[] normalizeDocumentHashBytes(String documentHash) throws Exception {
        if (documentHash == null) return new byte[0];
        String normalized = documentHash.trim();
        if (normalized.length() == 64 && normalized.matches("^[0-9a-fA-F]{64}$")) {
            return hexToBytes(normalized);
        }
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        return digest.digest(normalized.getBytes());
    }

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

    private String hashSHA256(String input) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(input.getBytes());
        return bytesToHex(hash);
    }

    /**
     * Generate a new ECDSA key pair (for testing or key recovery)
     * In production, keys are derived from user password
     */
    public KeyPair generateKeyPair() throws Exception {
        KeyPairGenerator keyGen = KeyPairGenerator.getInstance("EC", "BC");
        ECGenParameterSpec ecSpec = new ECGenParameterSpec("secp256k1"); // Ethereum-compatible curve
        keyGen.initialize(ecSpec, new SecureRandom());
        return keyGen.generateKeyPair();
    }

    /**
     * Signature statistics DTO
     */
    public static class SignatureStats {
        public final long totalSignatures;
        public final long validSignatures;

        public SignatureStats(long totalSignatures, long validSignatures) {
            this.totalSignatures = totalSignatures;
            this.validSignatures = validSignatures;
        }
    }
}
