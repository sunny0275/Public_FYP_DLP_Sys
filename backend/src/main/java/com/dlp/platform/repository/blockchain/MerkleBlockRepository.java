package com.dlp.platform.repository.blockchain;

import com.dlp.platform.entity.blockchain.MerkleBlock;
import com.dlp.platform.entity.blockchain.MerkleTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository for Merkle blockchain entities.
 * 
 * Provides operations for:
 * - Managing Merkle blocks (batch transactions)
 * - Managing Merkle transactions (watermark records)
 * - Lightweight client verification queries
 */
@Repository
public interface MerkleBlockRepository extends JpaRepository<MerkleBlock, Long> {

    /**
     * Find block by merkle root
     */
    Optional<MerkleBlock> findByMerkleRoot(String merkleRoot);

    /**
     * Find block by block number
     */
    Optional<MerkleBlock> findByBlockNumber(Long blockNumber);

    /**
     * Find block by block hash
     */
    Optional<MerkleBlock> findByBlockHash(String blockHash);

    /**
     * Get the latest block (highest block number)
     */
    Optional<MerkleBlock> findTopByOrderByBlockNumberDesc();

    /**
     * Get next block number
     */
    @Query("SELECT COALESCE(MAX(b.blockNumber), 0) + 1 FROM MerkleBlock b")
    Long getNextBlockNumber();

    /**
     * Find all pending blocks
     */
    List<MerkleBlock> findByStatusOrderByBlockNumberAsc(MerkleBlock.BlockStatus status);

    /**
     * Find blocks created after a timestamp
     */
    List<MerkleBlock> findByCreatedAtAfterOrderByBlockNumberAsc(LocalDateTime timestamp);

    /**
     * Count transactions in a block by block number
     */
    long countByBlockNumber(Long blockNumber);
}
