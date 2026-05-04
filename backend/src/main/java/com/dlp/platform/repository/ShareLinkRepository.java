package com.dlp.platform.repository;

import com.dlp.platform.entity.ShareLink;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ShareLinkRepository extends JpaRepository<ShareLink, Long> {

    /**
     * Find share link by token
     */
    Optional<ShareLink> findByToken(String token);

    /**
     * Find all shares for a document
     */
    List<ShareLink> findByDocumentId(Long documentId);

    /**
     * Find all shares created by a user
     */
    Page<ShareLink> findByCreatorId(Long creatorId, Pageable pageable);

    /**
     * Find active shares for a document
     */
    @Query("SELECT s FROM ShareLink s WHERE s.documentId = :documentId AND s.status = 'ACTIVE'")
    List<ShareLink> findActiveSharesByDocument(@Param("documentId") Long documentId);

    /**
     * Find expired but not yet marked shares
     */
    @Query("SELECT s FROM ShareLink s WHERE s.expiresAt < :now AND s.status = 'ACTIVE'")
    List<ShareLink> findExpiredShares(@Param("now") LocalDateTime now);

    /**
     * Atomic increment of access count (thread-safe)
     * Fixes race condition vulnerability
     */
    @Modifying
    @Query("UPDATE ShareLink s SET s.accessCount = s.accessCount + 1, s.lastAccessedAt = :now WHERE s.id = :id")
    int incrementAccessCount(@Param("id") Long id, @Param("now") LocalDateTime now);

    /**
     * Find shares requiring approval
     */
    @Query("SELECT s FROM ShareLink s WHERE s.requiresApproval = true AND s.approvalGranted = false AND s.status = 'PENDING_APPROVAL'")
    Page<ShareLink> findPendingApprovalShares(Pageable pageable);

    /**
     * Revoke all shares for a document
     */
    @Modifying
    @Query("UPDATE ShareLink s SET s.status = 'REVOKED', s.revokedAt = :now, s.revokedBy = :userId WHERE s.documentId = :documentId AND s.status = 'ACTIVE'")
    int revokeAllSharesForDocument(@Param("documentId") Long documentId, @Param("userId") Long userId, @Param("now") LocalDateTime now);

    /**
     * Count active shares for a document
     */
    @Query("SELECT COUNT(s) FROM ShareLink s WHERE s.documentId = :documentId AND s.status = 'ACTIVE'")
    long countActiveSharesForDocument(@Param("documentId") Long documentId);

    /**
     * Find shares by recipient
     */
    @Query("SELECT s FROM ShareLink s JOIN s.recipients r WHERE r.id = :userId")
    Page<ShareLink> findByRecipient(@Param("userId") Long userId, Pageable pageable);

    /**
     * Find document IDs shared with a user (active internal shares where user is recipient)
     */
    @Query("SELECT DISTINCT s.documentId FROM ShareLink s JOIN s.recipients r WHERE r.id = :userId " +
           "AND s.status = 'ACTIVE' AND s.shareType = 'INTERNAL' " +
           "AND (s.expiresAt IS NULL OR s.expiresAt > :now) " +
           "AND (s.requiresApproval = false OR s.approvalGranted = true)")
    java.util.List<Long> findDocumentIdsSharedWithUser(@Param("userId") Long userId, @Param("now") java.time.LocalDateTime now);
}
