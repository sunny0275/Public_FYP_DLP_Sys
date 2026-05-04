package com.dlp.platform.repository.blockchain;

import com.dlp.platform.entity.blockchain.MerkleTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for Merkle transactions.
 */
@Repository
public interface MerkleTransactionRepository extends JpaRepository<MerkleTransaction, Long> {

    /**
     * Find transaction by hash
     */
    Optional<MerkleTransaction> findByTransactionHash(String transactionHash);

    /**
     * Find all transactions for a document
     */
    List<MerkleTransaction> findByDocumentIdOrderByCreatedAtDesc(Long documentId);

    /**
     * Find all transactions for a user
     */
    List<MerkleTransaction> findByUserIdOrderByCreatedAtDesc(Long userId);

    /**
     * Find pending transactions (not yet in a confirmed block)
     */
    List<MerkleTransaction> findByStatusOrderByCreatedAtAsc(MerkleTransaction.TransactionStatus status);

    /**
     * Find transactions by block ID
     */
    List<MerkleTransaction> findByBlockIdOrderByLeafIndexAsc(Long blockId);

    /**
     * Count pending transactions
     */
    long countByStatus(MerkleTransaction.TransactionStatus status);

    /**
     * Find the latest transaction for a document
     */
    Optional<MerkleTransaction> findTopByDocumentIdOrderByCreatedAtDesc(Long documentId);

    /**
     * Check if document has any confirmed transactions
     */
    boolean existsByDocumentIdAndStatus(Long documentId, MerkleTransaction.TransactionStatus status);

    /**
     * Get pending transactions ordered by creation time (for batching)
     */
    @Query("SELECT t FROM MerkleTransaction t WHERE t.status = 'PENDING' ORDER BY t.createdAt ASC")
    List<MerkleTransaction> findPendingTransactionsForBatching();

    /**
     * Count pending transactions
     */
    @Query("SELECT COUNT(t) FROM MerkleTransaction t WHERE t.status = 'PENDING'")
    long countPendingTransactions();
}
