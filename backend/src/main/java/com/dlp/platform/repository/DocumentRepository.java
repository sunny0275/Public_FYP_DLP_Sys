package com.dlp.platform.repository;

import com.dlp.platform.entity.Document;
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
public interface DocumentRepository extends JpaRepository<Document, Long> {

    Page<Document> findByOwner(User owner, Pageable pageable);

    Page<Document> findByDepartment(String department, Pageable pageable);

    Page<Document> findByClassificationLevel(Document.ClassificationLevel level, Pageable pageable);

    Page<Document> findByStatus(Document.DocumentStatus status, Pageable pageable);

    @Query(
        value = "SELECT * FROM documents d WHERE (:query IS NULL OR d.name ILIKE CONCAT('%', CAST(:query AS varchar), '%'))",
        countQuery = "SELECT count(*) FROM documents d WHERE (:query IS NULL OR d.name ILIKE CONCAT('%', CAST(:query AS varchar), '%'))",
        nativeQuery = true
    )
    Page<Document> searchByNameOrDescription(@Param("query") String query, Pageable pageable);

    @Query("SELECT d FROM Document d JOIN d.tags t WHERE " +
           "t.name IN :tagNames")
    Page<Document> findByTagNames(@Param("tagNames") List<String> tagNames, Pageable pageable);

    @Query("SELECT d FROM Document d WHERE " +
           "d.department = :department AND " +
           "d.classificationLevel = :level")
    Page<Document> findByDepartmentAndClassificationLevel(
        @Param("department") String department,
        @Param("level") Document.ClassificationLevel level,
        Pageable pageable
    );

    @Query(
        value = """
            SELECT DISTINCT d.* FROM documents d
            LEFT JOIN document_tags dt ON d.id = dt.document_id
            WHERE
              (:query IS NULL OR d.name ILIKE CONCAT('%', CAST(:query AS varchar), '%')) AND
              (:department IS NULL OR d.department = :department) AND
              (:level IS NULL OR d.classification_level = CAST(:level AS varchar)) AND
              d.hidden = false AND
              d.updated_at >= COALESCE(:startDate, d.updated_at) AND
              d.updated_at <= COALESCE(:endDate, d.updated_at) AND
              (:status IS NULL OR d.status = CAST(:status AS varchar) OR (:status = 'ACTIVE' AND d.status = 'CLASSIFIED')) AND
              (
                d.owner_id = :userId OR
                (:isAdmin = true) OR
                (:isCeo = true) OR
                (:isSecurityAnalyst = true) OR
                (
                  :userDepartment IS NOT NULL AND d.department = :userDepartment AND (
                    d.classification_level IN ('PUBLIC','INTERNAL') OR
                    (:canReadDeptConfidential = true AND d.classification_level IN ('CONFIDENTIAL','STRICTLY_CONFIDENTIAL'))
                  )
                ) OR
                EXISTS (
                  SELECT 1 FROM share_links sl
                  JOIN share_recipients sr ON sl.id = sr.share_id
                  WHERE sl.document_id = d.id AND sr.user_id = :userId
                    AND sl.status = 'ACTIVE'
                    AND (sl.expires_at IS NULL OR sl.expires_at > :now)
                    AND (sl.requires_approval = false OR sl.approval_granted = true)
                )
              ) AND (
                d.status <> 'REVIEW_REQUIRED' OR
                d.owner_id = :userId OR
                (:isAdmin = true) OR
                (:isReviewer = true) OR
                (:isManager = true AND :userDepartment IS NOT NULL AND d.department = :userDepartment)
              )
            ORDER BY d.updated_at DESC
            """,
        countQuery = """
            SELECT COUNT(DISTINCT d.id) FROM documents d
            LEFT JOIN document_tags dt ON d.id = dt.document_id
            WHERE
              (:query IS NULL OR d.name ILIKE CONCAT('%', CAST(:query AS varchar), '%')) AND
              (:department IS NULL OR d.department = :department) AND
              (:level IS NULL OR d.classification_level = CAST(:level AS varchar)) AND
              d.hidden = false AND
              d.updated_at >= COALESCE(:startDate, d.updated_at) AND
              d.updated_at <= COALESCE(:endDate, d.updated_at) AND
              (:status IS NULL OR d.status = CAST(:status AS varchar) OR (:status = 'ACTIVE' AND d.status = 'CLASSIFIED')) AND
              (
                d.owner_id = :userId OR
                (:isAdmin = true) OR
                (:isCeo = true) OR
                (:isSecurityAnalyst = true) OR
                (
                  :userDepartment IS NOT NULL AND d.department = :userDepartment AND (
                    d.classification_level IN ('PUBLIC','INTERNAL') OR
                    (:canReadDeptConfidential = true AND d.classification_level IN ('CONFIDENTIAL','STRICTLY_CONFIDENTIAL'))
                  )
                ) OR
                EXISTS (
                  SELECT 1 FROM share_links sl
                  JOIN share_recipients sr ON sl.id = sr.share_id
                  WHERE sl.document_id = d.id AND sr.user_id = :userId
                    AND sl.status = 'ACTIVE'
                    AND (sl.expires_at IS NULL OR sl.expires_at > :now)
                    AND (sl.requires_approval = false OR sl.approval_granted = true)
                )
              ) AND (
                d.status <> 'REVIEW_REQUIRED' OR
                d.owner_id = :userId OR
                (:isAdmin = true) OR
                (:isReviewer = true) OR
                (:isManager = true AND :userDepartment IS NOT NULL AND d.department = :userDepartment)
              )
            """,
        nativeQuery = true
    )
    Page<Document> findWithFilters(
        @Param("query") String query,
        @Param("department") String department,
        @Param("level") String level,
        @Param("status") String status,
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate,
        @Param("userId") Long userId,
        @Param("userDepartment") String userDepartment,
        @Param("isAdmin") boolean isAdmin,
        @Param("isReviewer") boolean isReviewer,
        @Param("isCeo") boolean isCeo,
        @Param("isSecurityAnalyst") boolean isSecurityAnalyst,
        @Param("canReadDeptConfidential") boolean canReadDeptConfidential,
        @Param("isManager") boolean isManager,
        @Param("now") java.time.LocalDateTime now,
        Pageable pageable
    );
    
    @Query(
        value = """
            SELECT DISTINCT d.* FROM documents d
            JOIN document_tags dt ON d.id = dt.document_id
            JOIN tags t ON dt.tag_id = t.id
            WHERE
              (:query IS NULL OR d.name ILIKE CONCAT('%', CAST(:query AS varchar), '%')) AND
              (:department IS NULL OR d.department = :department) AND
              (:level IS NULL OR d.classification_level = CAST(:level AS varchar)) AND
              t.name IN (:tagNames) AND
              d.hidden = false AND
              d.updated_at >= COALESCE(:startDate, d.updated_at) AND
              d.updated_at <= COALESCE(:endDate, d.updated_at) AND
              (:status IS NULL OR d.status = CAST(:status AS varchar) OR (:status = 'ACTIVE' AND d.status = 'CLASSIFIED')) AND
              (
                d.owner_id = :userId OR
                (:isAdmin = true) OR
                (:isCeo = true) OR
                (:isSecurityAnalyst = true) OR
                (
                  :userDepartment IS NOT NULL AND d.department = :userDepartment AND (
                    d.classification_level IN ('PUBLIC','INTERNAL') OR
                    (:canReadDeptConfidential = true AND d.classification_level IN ('CONFIDENTIAL','STRICTLY_CONFIDENTIAL'))
                  )
                ) OR
                EXISTS (
                  SELECT 1 FROM share_links sl
                  JOIN share_recipients sr ON sl.id = sr.share_id
                  WHERE sl.document_id = d.id AND sr.user_id = :userId
                    AND sl.status = 'ACTIVE'
                    AND (sl.expires_at IS NULL OR sl.expires_at > :now)
                    AND (sl.requires_approval = false OR sl.approval_granted = true)
                )
              ) AND (
                d.status <> 'REVIEW_REQUIRED' OR
                d.owner_id = :userId OR
                (:isAdmin = true) OR
                (:isReviewer = true) OR
                (:isManager = true AND :userDepartment IS NOT NULL AND d.department = :userDepartment)
              )
            ORDER BY d.updated_at DESC
            """,
        countQuery = """
            SELECT COUNT(DISTINCT d.id) FROM documents d
            JOIN document_tags dt ON d.id = dt.document_id
            JOIN tags t ON dt.tag_id = t.id
            WHERE
              (:query IS NULL OR d.name ILIKE CONCAT('%', CAST(:query AS varchar), '%')) AND
              (:department IS NULL OR d.department = :department) AND
              (:level IS NULL OR d.classification_level = CAST(:level AS varchar)) AND
              t.name IN (:tagNames) AND
              d.hidden = false AND
              d.updated_at >= COALESCE(:startDate, d.updated_at) AND
              d.updated_at <= COALESCE(:endDate, d.updated_at) AND
              (:status IS NULL OR d.status = CAST(:status AS varchar) OR (:status = 'ACTIVE' AND d.status = 'CLASSIFIED')) AND
              (
                d.owner_id = :userId OR
                (:isAdmin = true) OR
                (:isCeo = true) OR
                (:isSecurityAnalyst = true) OR
                (
                  :userDepartment IS NOT NULL AND d.department = :userDepartment AND (
                    d.classification_level IN ('PUBLIC','INTERNAL') OR
                    (:canReadDeptConfidential = true AND d.classification_level IN ('CONFIDENTIAL','STRICTLY_CONFIDENTIAL'))
                  )
                ) OR
                EXISTS (
                  SELECT 1 FROM share_links sl
                  JOIN share_recipients sr ON sl.id = sr.share_id
                  WHERE sl.document_id = d.id AND sr.user_id = :userId
                    AND sl.status = 'ACTIVE'
                    AND (sl.expires_at IS NULL OR sl.expires_at > :now)
                    AND (sl.requires_approval = false OR sl.approval_granted = true)
                )
              ) AND (
                d.status <> 'REVIEW_REQUIRED' OR
                d.owner_id = :userId OR
                (:isAdmin = true) OR
                (:isReviewer = true) OR
                (:isManager = true AND :userDepartment IS NOT NULL AND d.department = :userDepartment)
              )
            """,
        nativeQuery = true
    )
    Page<Document> findWithFiltersAndTags(
        @Param("query") String query,
        @Param("department") String department,
        @Param("level") String level,
        @Param("status") String status,
        @Param("tagNames") List<String> tagNames,
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate,
        @Param("userId") Long userId,
        @Param("userDepartment") String userDepartment,
        @Param("isAdmin") boolean isAdmin,
        @Param("isReviewer") boolean isReviewer,
        @Param("isCeo") boolean isCeo,
        @Param("isSecurityAnalyst") boolean isSecurityAnalyst,
        @Param("canReadDeptConfidential") boolean canReadDeptConfidential,
        @Param("isManager") boolean isManager,
        @Param("now") java.time.LocalDateTime now,
        Pageable pageable
    );

    List<Document> findTop10ByOwnerOrderByUpdatedAtDesc(User owner);

    List<Document> findByExpirationDateBefore(LocalDateTime date);

    @Query("SELECT d FROM Document d WHERE d.requiresReview = true AND d.hidden = false AND d.status = :status")
    Page<Document> findDocumentsRequiringReview(@Param("status") Document.DocumentStatus status, Pageable pageable);

    @Query("SELECT d FROM Document d WHERE d.status = :status AND d.requiresReview = :requiresReview")
    Page<Document> findByStatusAndRequiresReview(
        @Param("status") Document.DocumentStatus status,
        @Param("requiresReview") Boolean requiresReview,
        Pageable pageable
    );

    @Query("SELECT COUNT(d) FROM Document d WHERE d.status = :status AND d.requiresReview = :requiresReview")
    long countByStatusAndRequiresReview(
        @Param("status") Document.DocumentStatus status,
        @Param("requiresReview") Boolean requiresReview
    );

    // Note: contentHash is not guaranteed unique, so return a list instead of Optional/single result
    List<Document> findByContentHash(String contentHash);

    @Query("SELECT COUNT(d) FROM Document d WHERE d.owner = :owner")
    Long countByOwner(@Param("owner") User owner);

    @Query("SELECT COUNT(d) FROM Document d WHERE d.department = :department")
    Long countByDepartment(@Param("department") String department);

    @Modifying
    @Query("UPDATE Document d SET d.owner = :newOwner WHERE d.owner = :oldOwner")
    void reassignOwner(@Param("oldOwner") User oldOwner, @Param("newOwner") User newOwner);

    // SECURITY: Atomic counter updates to prevent race conditions
    @Modifying
    @Query("UPDATE Document d SET d.viewCount = d.viewCount + 1, d.lastAccessedAt = :now WHERE d.id = :id")
    void incrementViewCount(@Param("id") Long id, @Param("now") LocalDateTime now);

    @Modifying
    @Query("UPDATE Document d SET d.downloadCount = d.downloadCount + 1, d.lastAccessedAt = :now WHERE d.id = :id")
    void incrementDownloadCount(@Param("id") Long id, @Param("now") LocalDateTime now);

    @Modifying
    @Query("UPDATE Document d SET d.shareCount = d.shareCount + 1 WHERE d.id = :id")
    void incrementShareCount(@Param("id") Long id);

    // SECURITY: DLP-aware query - filters documents at database level based on permissions
    @Query(
        value = """
            SELECT DISTINCT d.* FROM documents d
            LEFT JOIN document_tags dt ON d.id = dt.document_id
            LEFT JOIN tags t ON dt.tag_id = t.id
            LEFT JOIN users u ON d.owner_id = u.id
            WHERE
              (:query IS NULL OR d.name ILIKE CONCAT('%', CAST(:query AS varchar), '%')) AND
              (:department IS NULL OR d.department = :department) AND
              (:level IS NULL OR d.classification_level = CAST(:level AS varchar)) AND
              d.hidden = false AND
              (:status IS NULL OR d.status = CAST(:status AS varchar)) AND
              (
                -- Owner always sees
                d.owner_id = :userId OR
                -- Cross-department roles (RBAC)
                (:isAdmin = true) OR
                (:isCeo = true) OR
                (:isSecurityAnalyst = true) OR
                (:isComplianceOfficer = true) OR
                -- Department-based ABAC
                (
                  :userDepartment IS NOT NULL AND d.department = :userDepartment AND (
                    d.classification_level IN ('PUBLIC','INTERNAL') OR
                    (:canReadDeptConfidential = true AND d.classification_level = 'CONFIDENTIAL')
                  )
                )
              )
            ORDER BY d.updated_at DESC
            """,
        countQuery = """
            SELECT COUNT(DISTINCT d.id) FROM documents d
            LEFT JOIN document_tags dt ON d.id = dt.document_id
            LEFT JOIN tags t ON dt.tag_id = t.id
            LEFT JOIN users u ON d.owner_id = u.id
            WHERE
              (:query IS NULL OR d.name ILIKE CONCAT('%', CAST(:query AS varchar), '%')) AND
              (:department IS NULL OR d.department = :department) AND
              (:level IS NULL OR d.classification_level = CAST(:level AS varchar)) AND
              (:status IS NULL OR d.status = CAST(:status AS varchar)) AND
              (
                d.owner_id = :userId OR
                (:isAdmin = true) OR
                (:isCeo = true) OR
                (:isSecurityAnalyst = true) OR
                (:isComplianceOfficer = true) OR
                (
                  :userDepartment IS NOT NULL AND d.department = :userDepartment AND (
                    d.classification_level IN ('PUBLIC','INTERNAL') OR
                    (:canReadDeptConfidential = true AND d.classification_level = 'CONFIDENTIAL')
                  )
                )
              )
            """,
        nativeQuery = true
    )
    Page<Document> findWithFiltersAndPermissions(
        @Param("query") String query,
        @Param("department") String department,
        @Param("level") Document.ClassificationLevel level,
        @Param("status") Document.DocumentStatus status,
        @Param("userId") Long userId,
        @Param("userDepartment") String userDepartment,
        @Param("isAdmin") boolean isAdmin,
        @Param("isCeo") boolean isCeo,
        @Param("isSecurityAnalyst") boolean isSecurityAnalyst,
        @Param("isComplianceOfficer") boolean isComplianceOfficer,
        @Param("canReadDeptConfidential") boolean canReadDeptConfidential,
        Pageable pageable
    );
}
