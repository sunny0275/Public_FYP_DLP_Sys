package com.dlp.platform.repository;

import com.dlp.platform.entity.SignatureRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository for SignatureRecord entity
 */
@Repository
public interface SignatureRepository extends JpaRepository<SignatureRecord, Long> {

    /**
     * Find all signatures for a document, ordered by signing time
     * Returns the signature chain chronologically
     */
    List<SignatureRecord> findByDocumentIdOrderBySignedAtAsc(Long documentId);

    /**
     * Find all signatures by a specific user
     */
    List<SignatureRecord> findByUserIdOrderBySignedAtDesc(Long userId);

    /**
     * Find signatures by document and user
     */
    List<SignatureRecord> findByDocumentIdAndUserId(Long documentId, Long userId);

    /**
     * Find signatures by status
     */
    List<SignatureRecord> findByStatus(SignatureRecord.SignatureStatus status);

    /**
     * Find signatures created in a time range
     */
    List<SignatureRecord> findBySignedAtBetween(LocalDateTime start, LocalDateTime end);

    /**
     * Find signature by blockchain transaction hash
     */
    Optional<SignatureRecord> findByBlockchainTxHash(String txHash);

    /**
     * Count signatures for a document
     */
    long countByDocumentId(Long documentId);

    /**
     * Count valid signatures for a document
     */
    @Query("SELECT COUNT(s) FROM SignatureRecord s WHERE s.documentId = :documentId AND s.status = 'VALID'")
    long countValidSignaturesByDocument(@Param("documentId") Long documentId);

    /**
     * Check if a user has signed a document
     */
    boolean existsByDocumentIdAndUserIdAndStatus(Long documentId, Long userId, SignatureRecord.SignatureStatus status);

    /**
     * Get latest signature for a document
     */
    @Query("SELECT s FROM SignatureRecord s WHERE s.documentId = :documentId ORDER BY s.signedAt DESC LIMIT 1")
    Optional<SignatureRecord> findLatestByDocument(@Param("documentId") Long documentId);

    /**
     * Find pending signature verifications
     */
    List<SignatureRecord> findByStatusOrderBySignedAtAsc(SignatureRecord.SignatureStatus status);

    @Modifying
    @Query("UPDATE SignatureRecord s SET s.userId = :newUserId WHERE s.userId = :oldUserId")
    int reassignSigner(@Param("oldUserId") Long oldUserId, @Param("newUserId") Long newUserId);
}
