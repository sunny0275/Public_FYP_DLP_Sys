package com.dlp.platform.dto.document;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request payload for reviewer to approve document classification level
 * 
 * Signature Evidence:
 * When a reviewer approves/rejects a classification, an digital signature record
 * is created that cryptographically binds:
 * - The reviewer's identity
 * - The decision (approve/reject)
 * - The document content hash (to prove what was approved)
 * - Timestamp (RFC 3161)
 * - Optional blockchain anchor
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApproveClassificationRequest {
    /**
     * Final classification level to approve
     * Required when approveCurrentLevel is false
     */
    private String approvedClassificationLevel;

    /**
     * Reviewer's comment/notes
     */
    private String comment;

    /**
     * Whether to approve the current level or override it
     */
    @NotNull
    @Builder.Default
    private Boolean approveCurrentLevel = true;

    // ========== Digital Signature Evidence Fields ==========
    
    /**
     * Reviewer's private key for ECDSA signature (optional)
     * If not provided, server-managed signing key will be used
     * Format: hex-encoded PKCS#8 DER or raw 32-byte secp256k1 scalar
     */
    private String privateKeyHex;

    /**
     * MFA verification code (optional, for additional verification)
     * If MFA is required by policy, this field must be provided
     */
    private String mfaCode;

    /**
     * Device fingerprint for signature audit trail
     */
    private String deviceFingerprint;

    // ========== End Digital Signature Evidence Fields ==========
}
