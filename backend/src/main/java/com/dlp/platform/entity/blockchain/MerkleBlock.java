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
 * Merkle Block Entity - Represents a batch of watermark records in a Merkle tree.
 * 
 * This entity stores:
 * - Merkle root hash of all records in the batch
 * - List of record hashes included in this block
 * - Timestamp for ordering
 * 
 * In a real blockchain, this would be an actual block. Here we simulate it
 * using PostgreSQL for lightweight client verification.
 */
@Entity
@Table(
    name = "merkle_block",
    indexes = {
        @Index(name = "idx_merkle_root", columnList = "merkleRoot", unique = true),
        @Index(name = "idx_merkle_block_number", columnList = "blockNumber", unique = true),
        @Index(name = "idx_merkle_timestamp", columnList = "createdAt")
    }
)
@EntityListeners(AuditingEntityListener.class)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MerkleBlock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Sequential block number (simulates blockchain height) */
    @Column(nullable = false, unique = true)
    private Long blockNumber;

    /** SHA-256 hash of this block's data */
    @Column(nullable = false, length = 64, unique = true)
    private String blockHash;

    /** Merkle root of all transactions in this block */
    @Column(nullable = false, length = 64)
    private String merkleRoot;

    /** SHA-256 hash of previous block (creates chain) */
    @Column(length = 64)
    private String previousBlockHash;

    /** Number of watermark records in this block */
    @Column(nullable = false)
    private Integer transactionCount;

    /** Block status: CONFIRMED, PENDING */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private BlockStatus status = BlockStatus.PENDING;

    /** Block creation timestamp */
    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /** Block confirmation timestamp (when added to chain) */
    @Column
    private LocalDateTime confirmedAt;

    /** Additional metadata (JSON string) */
    @Column(columnDefinition = "TEXT")
    private String metadata;

    public enum BlockStatus {
        PENDING,    // Block created but not yet confirmed
        CONFIRMED   // Block confirmed and added to chain
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (status == null) {
            status = BlockStatus.PENDING;
        }
    }

    /**
     * Check if this block has been confirmed
     */
    public boolean isConfirmed() {
        return status == BlockStatus.CONFIRMED;
    }

    /**
     * Get the age of this block in seconds
     */
    public long getAgeSeconds() {
        if (createdAt == null) {
            return 0;
        }
        return java.time.Duration.between(createdAt, LocalDateTime.now()).getSeconds();
    }
}
