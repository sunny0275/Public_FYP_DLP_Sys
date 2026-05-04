package com.dlp.platform.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Envelope encryption metadata per document.
 * - Document content is encrypted using a random DEK.
 * - DEK is wrapped by the owner's operational private key and stored here as encryptedDekBase64.
 */
@Entity
@Table(name = "document_keys", indexes = {
    @Index(name = "idx_document_key_document_id", columnList = "document_id", unique = true),
    @Index(name = "idx_document_key_owner_user_id", columnList = "owner_user_id"),
    @Index(name = "idx_document_key_version", columnList = "key_version")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentKey {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "document_id", nullable = false, unique = true)
    private Long documentId;

    @Column(name = "owner_user_id", nullable = false)
    private Long ownerUserId;

    @Column(name = "key_version", nullable = false)
    private Integer keyVersion;

    @Column(name = "encrypted_dek", nullable = false, columnDefinition = "TEXT")
    private String encryptedDekBase64;

    @Column(name = "algorithm", nullable = false, length = 50)
    @Builder.Default
    private String algorithm = "AES/GCM/NoPadding";

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}

