package com.dlp.platform.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/**
 * X.509 certificate record for PKI-backed document signatures.
 *
 * Notes:
 * - We store PEM so UI can display/download certificate chain.
 * - Revocation is tracked for CRL/OCSP responder.
 */
@Entity
@Table(name = "user_certificates", indexes = {
    @Index(name = "idx_user_cert_user", columnList = "user_id"),
    @Index(name = "idx_user_cert_serial", columnList = "serial_hex", unique = true),
    @Index(name = "idx_user_cert_status", columnList = "status")
})
@EntityListeners(AuditingEntityListener.class)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserCertificate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "serial_hex", nullable = false, length = 128, unique = true)
    private String serialHex;

    @Column(name = "certificate_pem", nullable = false, columnDefinition = "TEXT")
    private String certificatePem;

    @Column(name = "public_key_fingerprint", nullable = false, length = 64)
    private String publicKeyFingerprint; // SHA-256 hex of SubjectPublicKeyInfo

    @Column(name = "not_before", nullable = false)
    private LocalDateTime notBefore;

    @Column(name = "not_after", nullable = false)
    private LocalDateTime notAfter;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private Status status;

    private LocalDateTime revokedAt;

    @Column(columnDefinition = "TEXT")
    private String revocationReason;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    public enum Status {
        ACTIVE,
        REVOKED,
        EXPIRED
    }
}


