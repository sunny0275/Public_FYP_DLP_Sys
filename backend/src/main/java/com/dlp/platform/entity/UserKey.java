package com.dlp.platform.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Per-user encryption key material for DLP document encryption and key self-destruct/recovery.
 * Private key is never stored; derived from password + salt at runtime.
 * Recovery key is encrypted with private key; private key is also encrypted with recovery key for recovery flow.
 */
@Entity
@Table(name = "user_keys", indexes = {
    @Index(name = "idx_user_key_user_id", columnList = "user_id"),
    @Index(name = "idx_user_key_status", columnList = "key_status")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserKey {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Column(name = "key_version", nullable = false)
    private Integer keyVersion;

    /** Salt for key derivation (PBKDF2/Argon2), hex-encoded. */
    @Column(nullable = false, length = 128)
    private String saltHex;

    /** IV for AES-GCM, hex-encoded. */
    @Column(nullable = false, length = 64)
    private String ivHex;

    /** Recovery key encrypted with private key (for verification when user has password). Base64. */
    @Column(name = "encrypted_recovery_key", nullable = false, columnDefinition = "TEXT")
    private String encryptedRecoveryKeyBase64;

    /** Private key encrypted with recovery key (for recovery when user forgot password). Base64. */
    @Column(name = "encrypted_private_key", nullable = false, columnDefinition = "TEXT")
    private String encryptedPrivateKeyBase64;

    /**
     * Operational copy of the private key encrypted with a server-side master secret.
     * Used by backend services to encrypt/decrypt document DEKs without requiring plaintext user password on each request.
     */
    @Column(name = "encrypted_operational_private_key", columnDefinition = "TEXT")
    private String encryptedOperationalPrivateKeyBase64;

    /**
     * Key identifier used to encrypt encryptedOperationalPrivateKeyBase64.
     * Supports safe server master-key rotation.
     */
    @Column(name = "operational_key_id", length = 64)
    private String operationalKeyId;

    @Enumerated(EnumType.STRING)
    @Column(name = "key_status", nullable = false, length = 30)
    private KeyStatus keyStatus;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;

    @Column(name = "revoked_reason", length = 500)
    private String revokedReason;

    /** Optional blockchain tx hash when this key was revoked (audit anchor). */
    @Column(name = "revoke_blockchain_tx_hash", length = 66)
    private String revokeBlockchainTxHash;

    public enum KeyStatus {
        ACTIVE,
        REVOKED,
        REGENERATING
    }
}
