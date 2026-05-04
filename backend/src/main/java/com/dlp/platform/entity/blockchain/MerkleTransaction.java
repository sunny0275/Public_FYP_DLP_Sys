package com.dlp.platform.entity.blockchain;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/**
 * Merkle Transaction Entity - Represents a single watermark record within a Merkle block.
 * 
 * Each transaction corresponds to a watermark applied to a document.
 * The transaction hash is included in the Merkle tree for this block.
 */
@Entity
@Table(
    name = "merkle_transaction",
    indexes = {
        @Index(name = "idx_tx_hash", columnList = "transactionHash", unique = true),
        @Index(name = "idx_tx_block_id", columnList = "blockId"),
        @Index(name = "idx_tx_document_id", columnList = "documentId"),
        @Index(name = "idx_tx_user_id", columnList = "userId"),
        @Index(name = "idx_tx_timestamp", columnList = "createdAt")
    }
)
@EntityListeners(AuditingEntityListener.class)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MerkleTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Reference to the Merkle block containing this transaction */
    @Column(nullable = false)
    private Long blockId;

    /** SHA-256 hash of this transaction (unique identifier) */
    @Column(nullable = false, length = 64, unique = true)
    private String transactionHash;

    /** Index position within the Merkle tree (leaf node index) */
    @Column(nullable = false)
    private Integer leafIndex;

    /** SHA-256 hash of the leaf data (document hash) */
    @Column(nullable = false, length = 64)
    private String leafHash;

    /** Associated document ID */
    @Column
    private Long documentId;

    /** Associated user ID */
    @Column
    private Long userId;

    /** IP address where watermark was applied */
    @Column(length = 45)
    private String ipAddress;

    /** Watermark type: UPLOAD, SHARE, DOWNLOAD, VIEW */
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private WatermarkType watermarkType;

    /** Action timestamp (when watermark was applied) */
    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /** Merkle proof path (JSON array of sibling hashes) */
    @Column(columnDefinition = "TEXT")
    private String merkleProofPath;

    /** Transaction status: PENDING, CONFIRMED, INVALID */
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    @Builder.Default
    private TransactionStatus status = TransactionStatus.PENDING;

    public enum WatermarkType {
        UPLOAD,     // Watermark applied during document upload
        SHARE,      // Watermark applied when document is shared
        DOWNLOAD,   // Watermark applied when document is downloaded
        VIEW,       // Watermark applied when document is viewed/previewed
        PRINT       // Watermark applied when document is printed
    }

    public enum TransactionStatus {
        PENDING,    // Transaction created but not yet in a confirmed block
        CONFIRMED,  // Transaction in a confirmed block
        INVALID     // Transaction marked as invalid
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (status == null) {
            status = TransactionStatus.PENDING;
        }
    }

    /**
     * Check if this transaction is confirmed
     */
    public boolean isConfirmed() {
        return status == TransactionStatus.CONFIRMED;
    }

    /**
     * Get the Merkle proof as a list
     */
    public java.util.List<String> getMerkleProof() {
        if (merkleProofPath == null || merkleProofPath.isBlank()) {
            return java.util.Collections.emptyList();
        }
        try {
            return new java.util.ArrayList<>(java.util.Arrays.asList(
                merkleProofPath.replace("[", "").replace("]", "").replace("\"", "").split(",")
            ));
        } catch (Exception e) {
            return java.util.Collections.emptyList();
        }
    }

    /**
     * Set the Merkle proof from a list
     */
    public void setMerkleProof(java.util.List<String> proof) {
        if (proof == null || proof.isEmpty()) {
            this.merkleProofPath = null;
        } else {
            this.merkleProofPath = "[\"" + String.join("\",\"", proof) + "\"]";
        }
    }
}
