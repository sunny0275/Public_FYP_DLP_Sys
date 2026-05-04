package com.dlp.platform.repository;

import com.dlp.platform.entity.UploadJob;
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
public interface UploadJobRepository extends JpaRepository<UploadJob, Long> {

    List<UploadJob> findByUserOrderByCreatedAtDesc(User user);

    Page<UploadJob> findByUser(User user, Pageable pageable);

    List<UploadJob> findByStatus(UploadJob.JobStatus status);

    @Query("SELECT uj FROM UploadJob uj WHERE " +
           "uj.status = 'PROCESSING' AND " +
           "uj.updatedAt < :timeout")
    List<UploadJob> findStalledJobs(@Param("timeout") LocalDateTime timeout);

    @Query("SELECT uj FROM UploadJob uj WHERE " +
           "uj.user = :user AND " +
           "uj.status IN ('PROCESSING', 'PENDING')")
    List<UploadJob> findActiveJobsByUser(@Param("user") User user);

    @Query("SELECT COUNT(uj) FROM UploadJob uj WHERE " +
           "uj.user = :user AND " +
           "uj.status = :status")
    Long countByUserAndStatus(@Param("user") User user, @Param("status") UploadJob.JobStatus status);

    @Modifying
    @Query("UPDATE UploadJob uj SET uj.user = :newUser WHERE uj.user = :oldUser")
    int reassignUser(@Param("oldUser") User oldUser, @Param("newUser") User newUser);

    @Query("SELECT uj FROM UploadJob uj WHERE uj.document.id = :documentId")
    List<UploadJob> findByDocumentId(@Param("documentId") Long documentId);
}
