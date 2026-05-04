package com.dlp.platform.repository;

import com.dlp.platform.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long>, JpaSpecificationExecutor<AuditLog> {

    Page<AuditLog> findByUserId(Long userId, Pageable pageable);
    Page<AuditLog> findByCategory(String category, Pageable pageable);
    Page<AuditLog> findByAction(String action, Pageable pageable);

    @Query("SELECT al FROM AuditLog al WHERE al.timestamp BETWEEN :startDate AND :endDate")
    Page<AuditLog> findByTimestampBetween(LocalDateTime startDate, LocalDateTime endDate, Pageable pageable);

    @Query("SELECT al FROM AuditLog al WHERE al.userId = :userId AND al.category = :category ORDER BY al.timestamp DESC")
    List<AuditLog> findRecentUserActivityByCategory(Long userId, String category, Pageable pageable);

    List<AuditLog> findTop50ByOrderByTimestampDesc();

    List<AuditLog> findTop50ByCategoryInAndResultInOrderByTimestampDesc(
            Collection<String> categories, Collection<String> results);

    AuditLog findFirstByIdLessThanOrderByIdDesc(Long id);
    AuditLog findFirstByIdLessThanAndImmutableHashIsNotNullOrderByIdDesc(Long id);
    AuditLog findFirstByImmutableHashIsNotNullOrderByIdDesc();
    AuditLog findFirstByImmutableHashIsNullOrderByIdAsc();
    List<AuditLog> findByImmutableHashIsNullOrderByIdAsc();

    long countByAnchorStatus(String anchorStatus);
    Page<AuditLog> findByAnchorStatusOrderByIdAsc(String anchorStatus, Pageable pageable);

    @Query("SELECT al FROM AuditLog al WHERE (al.result IN :results OR al.action = :action) ORDER BY al.timestamp DESC")
    List<AuditLog> findTop50AlertsOrderByTimestampDesc(
            @Param("results") Collection<String> results, @Param("action") String action, Pageable pageable);

    @Query("SELECT al FROM AuditLog al WHERE (al.result IN :results OR al.action = :action) AND al.userId = :userId ORDER BY al.timestamp DESC")
    List<AuditLog> findTop50AlertsForUserOrderByTimestampDesc(
            @Param("userId") Long userId, @Param("results") Collection<String> results, @Param("action") String action, Pageable pageable);

    long countByImmutableHashIsNull();

    @Modifying
    @Query("UPDATE AuditLog a SET a.anchorStatus = 'NOT_CHAINED' WHERE a.immutableHash IS NULL")
    int markUnchainedAsNotChained();

    @Modifying
    @Query("DELETE FROM AuditLog a WHERE a.immutableHash IS NULL")
    int deleteUnchainedLogs();

    @Modifying
    @Query("DELETE FROM AuditLog a WHERE a.action = :action")
    int deleteByAction(@Param("action") String action);

    @Query("SELECT COUNT(al) FROM AuditLog al WHERE al.userId = :userId AND al.action = 'VIEW' AND al.timestamp >= :since")
    long countRecentViews(@Param("userId") Long userId, @Param("since") LocalDateTime since);

    @Query("SELECT al FROM AuditLog al WHERE al.userId = :userId AND al.action = :action " +
           "AND al.timestamp >= :startTime AND al.timestamp <= :endTime ORDER BY al.timestamp DESC")
    List<AuditLog> findByUserIdAndActionAndTimeRange(
            @Param("userId") Long userId, @Param("action") String action,
            @Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime);
}
