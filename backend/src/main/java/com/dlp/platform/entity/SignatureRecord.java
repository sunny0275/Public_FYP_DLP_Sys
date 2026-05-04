package com.dlp.platform.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Entity representing a digital signature record for documents
 *
 * Features:
 * - ECDSA signature storage (secp256k1 curve - Ethereum compatible)
 * - RFC 3161 timestamp token for non-repudiation
 * - Optional blockchain transaction hash for immutability
 * - Signature chain tracking (multiple signers per document)
 */
@Entity
@Table(name = "signatures", indexes = {
    @Index(name = "idx_signature_document", columnList = "document_id"),
    @Index(name = "idx_signature_user", columnList = "user_id"),
    @Index(name = "idx_signature_created", columnList = "signed_at")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SignatureRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Document being signed
     */
    @Column(name = "document_id", nullable = false)
    private Long documentId;

    /**
     * User who signed the document
     */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /**
     * Hex-encoded ECDSA signature (r,s,v format)
     * Generated using secp256k1 curve for Ethereum compatibility
     */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String signatureHex;

    /**
     * Signer's public key (X.509 SubjectPublicKeyInfo), hex-encoded.
     * Used to verify the ECDSA signature later (PKI-style verification).
     */
    @Column(columnDefinition = "TEXT")
    private String publicKeyHex;

    /**
     * Leaf X.509 certificate PEM (signer certificate) bound to this signature.
     */
    @Column(columnDefinition = "TEXT")
    private String certificatePem;

    /**
     * Issuer (CA) certificate PEM for building the chain (minimal chain = leaf + issuer).
     */
    @Column(columnDefinition = "TEXT")
    private String issuerCertificatePem;

    /**
     * Certificate serial number (hex string) for revocation checks (CRL/OCSP).
     */
    @Column(length = 128)
    private String certificateSerialHex;

    /**
     * SHA-256 hash of the document content at time of signing
     * Ensures signature validity even if document is modified later
     */
    @Column(nullable = false, length = 64)
    private String documentHash;

    /**
     * RFC 3161 timestamp token (Base64-encoded)
     * Provides cryptographic proof of when the signature was created
     * Issued by Time Stamp Authority (TSA)
     */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String timestampToken;

    /**
     * Optional blockchain transaction hash
     * Anchors the signature hash to Ethereum blockchain for immutability
     * NULL if blockchain anchoring is disabled
     */
    @Column(columnDefinition = "TEXT")
    private String blockchainTxHash;

    /**
     * Timestamp when signature was created
     */
    @Column(nullable = false)
    private LocalDateTime signedAt;

    /**
     * IP address of the signer
     */
    @Column(length = 45)
    private String ipAddress;

    /**
     * Device fingerprint of signer's device
     */
    @Column(length = 255)
    private String deviceFingerprint;

    /**
     * MFA verification code used before signing
     * Stored for audit purposes
     */
    @Column(length = 10)
    private String mfaVerificationCode;

    /**
     * Signature verification status
     * - VALID: Signature verified successfully
     * - INVALID: Signature verification failed
     * - REVOKED: Signature revoked by admin
     * - PENDING: Verification pending
     */
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private SignatureStatus status;

    /**
     * Reason for revocation (if status = REVOKED)
     */
    @Column(columnDefinition = "TEXT")
    private String revocationReason;

    /**
     * When the signature was verified/revoked
     */
    private LocalDateTime statusChangedAt;

    /**
     * User who changed the status (for revocation tracking)
     */
    private Long statusChangedBy;

    /**
     * Signature type to distinguish different signing actions
     * - UPLOAD: Document upload signature
     * - CLASSIFICATION_APPROVE: Classification approval signature
     * - APPROVE_SHARE: Share approval signature
     * - MANUAL_SIGN: Manual signature by user
     */
    @Column(length = 50, nullable = false)
    private String signatureType;

    // Relationships

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id", insertable = false, updatable = false)
    private Document document;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    /**
     * Signature status enum
     */
    public enum SignatureStatus {
        PENDING,
        VALID,
        INVALID,
        REVOKED
    }

    /**
     * Mark signature as verified
     */
    public void markAsValid() {
        this.status = SignatureStatus.VALID;
        this.statusChangedAt = LocalDateTime.now();
    }

    /**
     * Mark signature as invalid
     */
    public void markAsInvalid() {
        this.status = SignatureStatus.INVALID;
        this.statusChangedAt = LocalDateTime.now();
    }

    /**
     * Revoke signature with reason
     */
    public void revoke(Long revokedBy, String reason) {
        this.status = SignatureStatus.REVOKED;
        this.revocationReason = reason;
        this.statusChangedAt = LocalDateTime.now();
        this.statusChangedBy = revokedBy;
    }

    /**
     * Check if signature is still valid
     */
    public boolean isValid() {
        return this.status == SignatureStatus.VALID;
    }

    @PrePersist
    protected void onCreate() {
        if (signedAt == null) {
            signedAt = LocalDateTime.now();
        }
        if (status == null) {
            status = SignatureStatus.PENDING;
        }
    }
}
