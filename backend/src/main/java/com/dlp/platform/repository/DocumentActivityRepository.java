package com.dlp.platform.repository;

import com.dlp.platform.entity.Document;
import com.dlp.platform.entity.DocumentActivity;
import com.dlp.platform.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface DocumentActivityRepository extends JpaRepository<DocumentActivity, Long> {

    List<DocumentActivity> findByDocumentOrderByTimestampDesc(Document document);

    List<DocumentActivity> findByUserOrderByTimestampDesc(User user);

    Page<DocumentActivity> findByDocument(Document document, Pageable pageable);

    Page<DocumentActivity> findByUser(User user, Pageable pageable);

    @Query("SELECT da FROM DocumentActivity da WHERE " +
           "(:documentId IS NULL OR da.document.id = :documentId) AND " +
           "(:userId IS NULL OR da.user.id = :userId) AND " +
           "(:activityType IS NULL OR da.activityType = :activityType) AND " +
           "(:startDate IS NULL OR da.timestamp >= :startDate) AND " +
           "(:endDate IS NULL OR da.timestamp <= :endDate) " +
           "ORDER BY da.timestamp DESC")
    Page<DocumentActivity> findWithFilters(
        @Param("documentId") Long documentId,
        @Param("userId") Long userId,
        @Param("activityType") DocumentActivity.ActivityType activityType,
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate,
        Pageable pageable
    );

    @Query("SELECT da FROM DocumentActivity da WHERE " +
           "da.document.id = :documentId AND " +
           "da.activityType = :activityType " +
           "ORDER BY da.timestamp DESC")
    List<DocumentActivity> findByDocumentIdAndActivityType(
        @Param("documentId") Long documentId,
        @Param("activityType") DocumentActivity.ActivityType activityType
    );

    @Query("SELECT COUNT(da) FROM DocumentActivity da WHERE " +
           "da.document.id = :documentId AND " +
           "da.activityType = 'VIEW' AND " +
           "da.result = 'SUCCESS'")
    Long countViewsByDocumentId(@Param("documentId") Long documentId);

    @Query("SELECT COUNT(da) FROM DocumentActivity da WHERE " +
           "da.document.id = :documentId AND " +
           "da.activityType = 'DOWNLOAD' AND " +
           "da.result = 'SUCCESS'")
    Long countDownloadsByDocumentId(@Param("documentId") Long documentId);

    @Modifying
    @Query("UPDATE DocumentActivity da SET da.user = :newUser WHERE da.user = :oldUser")
    int reassignUser(@Param("oldUser") User oldUser, @Param("newUser") User newUser);
}
