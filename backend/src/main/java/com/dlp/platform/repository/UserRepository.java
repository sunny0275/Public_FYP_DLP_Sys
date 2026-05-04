package com.dlp.platform.repository;

import com.dlp.platform.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByAccountId(String accountId);

    /**
     * Case-insensitive search for accountId.
     * Use this when the accountId might have different case than stored in DB.
     */
    @Query("SELECT u FROM User u WHERE LOWER(u.accountId) = LOWER(:accountId)")
    Optional<User> findByAccountIdIgnoreCase(@Param("accountId") String accountId);

    Optional<User> findByEmail(String email);

    boolean existsByAccountId(String accountId);

    boolean existsByEmail(String email);

    /**
     * Find the first active admin user, used for attributing system-level audit events
     * (e.g., Chain Guardian alerts) to a real user rather than a sentinel SYSTEM accountId.
     */
    @Query("""
        SELECT u FROM User u
        WHERE u.deletedAt IS NULL
          AND u.accountEnabled = true
          AND 'ADMIN' MEMBER OF u.roles
        ORDER BY u.id ASC
        LIMIT 1
        """)
    Optional<User> findFirstActiveAdmin();

    List<User> findByFullNameContainingIgnoreCase(String fullName);

    @Query("SELECT u FROM User u WHERE u.passwordExpiryDate < :date AND u.accountEnabled = true")
    List<User> findUsersWithExpiredPasswords(LocalDateTime date);

    @Query("SELECT u FROM User u WHERE u.passwordExpiryDate BETWEEN :now AND :expiryDate AND u.accountEnabled = true")
    List<User> findUsersWithPasswordExpiringSoon(LocalDateTime now, LocalDateTime expiryDate);

    long countByAccountIdStartingWith(String prefix);

    long countByDeletedAtIsNotNull();

    @Query("SELECT COUNT(u) FROM User u WHERE u.deletedAt IS NULL")
    long countNotDeleted();

    @Query("SELECT COUNT(u) FROM User u WHERE u.deletedAt IS NULL AND u.accountEnabled = true")
    long countEnabledNotDeleted();

    @Query("SELECT COUNT(u) FROM User u WHERE u.deletedAt IS NULL AND u.accountLocked = true")
    long countLockedNotDeleted();

    @Query("SELECT COUNT(u) FROM User u WHERE u.deletedAt IS NULL AND u.mfaEnabled = true")
    long countMfaEnabledNotDeleted();

    /**
     * "Usable" users for admin metrics: not deleted, enabled, and not a system identity.
     */
    @Query("SELECT COUNT(u) FROM User u WHERE u.deletedAt IS NULL AND u.accountEnabled = true AND COALESCE(u.systemAccount, false) = false")
    long countUsableUsers();

    /**
     * "Listable" users: same as usable but exclude archived_* accountIds so the count matches the Admin Panel user table.
     */
    @Query("SELECT COUNT(u) FROM User u WHERE u.deletedAt IS NULL AND u.accountEnabled = true AND COALESCE(u.systemAccount, false) = false AND (LOCATE('archived_', u.accountId) <> 1)")
    long countListableUsers();

    @Query("SELECT COUNT(u) FROM User u WHERE u.deletedAt IS NULL AND u.accountEnabled = true AND COALESCE(u.systemAccount, false) = false AND u.accountLocked = true")
    long countLockedUsableUsers();

    @Query("SELECT COUNT(u) FROM User u WHERE u.deletedAt IS NULL AND u.accountEnabled = true AND COALESCE(u.systemAccount, false) = false AND u.accountLocked = true AND (LOCATE('archived_', u.accountId) <> 1)")
    long countLockedListableUsers();

    @Query("SELECT COUNT(u) FROM User u WHERE u.deletedAt IS NULL AND u.accountEnabled = true AND COALESCE(u.systemAccount, false) = false AND u.mfaEnabled = true")
    long countMfaEnabledUsableUsers();

    @Query("SELECT COUNT(u) FROM User u WHERE u.deletedAt IS NULL AND u.accountEnabled = true AND COALESCE(u.systemAccount, false) = false AND u.mfaEnabled = true AND (LOCATE('archived_', u.accountId) <> 1)")
    long countMfaEnabledListableUsers();

    @Query("SELECT COUNT(u) FROM User u WHERE u.deletedAt IS NULL AND u.accountEnabled = true AND COALESCE(u.systemAccount, false) = false AND u.createdAt >= :since")
    long countNewUsableUsersSince(@Param("since") LocalDateTime since);

    @Query("SELECT COUNT(u) FROM User u WHERE u.deletedAt IS NULL AND u.accountEnabled = true AND COALESCE(u.systemAccount, false) = false AND u.createdAt >= :since AND (LOCATE('archived_', u.accountId) <> 1)")
    long countNewListableUsersSince(@Param("since") LocalDateTime since);

    @Query("SELECT COUNT(u) FROM User u WHERE u.deletedAt IS NULL AND u.createdAt >= :since")
    long countNewUsersSince(@Param("since") LocalDateTime since);

    @Query("SELECT COALESCE(u.department, '(Unassigned)') as dept, COUNT(u) as cnt FROM User u WHERE u.deletedAt IS NULL GROUP BY COALESCE(u.department, '(Unassigned)') ORDER BY cnt DESC")
    List<Object[]> countUsersByDepartment();

    @Query("SELECT r as role, COUNT(u) as cnt FROM User u JOIN u.roles r WHERE u.deletedAt IS NULL GROUP BY r ORDER BY cnt DESC")
    List<Object[]> countUsersByRole();

    @Query("""
        SELECT COALESCE(u.department, '(Unassigned)') as dept, COUNT(u) as cnt
        FROM User u
        WHERE u.deletedAt IS NULL AND u.accountEnabled = true AND COALESCE(u.systemAccount, false) = false
        GROUP BY COALESCE(u.department, '(Unassigned)')
        ORDER BY cnt DESC
        """)
    List<Object[]> countUsableUsersByDepartment();

    @Query("""
        SELECT r as role, COUNT(u) as cnt
        FROM User u JOIN u.roles r
        WHERE u.deletedAt IS NULL AND u.accountEnabled = true AND COALESCE(u.systemAccount, false) = false
        GROUP BY r
        ORDER BY cnt DESC
        """)
    List<Object[]> countUsableUsersByRole();

    @Query("""
        SELECT COALESCE(u.department, '(Unassigned)') as dept, COUNT(u) as cnt
        FROM User u
        WHERE u.deletedAt IS NULL AND u.accountEnabled = true AND COALESCE(u.systemAccount, false) = false
          AND (LOCATE('archived_', u.accountId) <> 1)
        GROUP BY COALESCE(u.department, '(Unassigned)')
        ORDER BY cnt DESC
        """)
    List<Object[]> countListableUsersByDepartment();

    @Query("""
        SELECT r as role, COUNT(u) as cnt
        FROM User u JOIN u.roles r
        WHERE u.deletedAt IS NULL AND u.accountEnabled = true AND COALESCE(u.systemAccount, false) = false
          AND (LOCATE('archived_', u.accountId) <> 1)
        GROUP BY r
        ORDER BY cnt DESC
        """)
    List<Object[]> countListableUsersByRole();

    @Query("SELECT DISTINCT u FROM User u JOIN u.roles r WHERE r = :role")
    List<User> findByRole(String role);

    @Query("""
        SELECT u FROM User u
        WHERE u.deletedAt IS NULL
          AND u.accountEnabled = true
          AND (
            lower(u.accountId) LIKE concat('%', :q, '%')
            OR lower(u.email) LIKE concat('%', :q, '%')
            OR lower(u.fullName) LIKE concat('%', :q, '%')
          )
        """)
    List<User> searchActiveUsers(@Param("q") String q, Pageable pageable);

    @Query("""
        SELECT u FROM User u
        WHERE u.deletedAt IS NULL
          AND u.accountEnabled = true
          AND (:department IS NULL OR u.department = :department)
          AND (
            lower(u.accountId) LIKE concat('%', :q, '%')
            OR lower(u.email) LIKE concat('%', :q, '%')
            OR lower(u.fullName) LIKE concat('%', :q, '%')
          )
        """)
    List<User> searchActiveUsersInDepartment(@Param("q") String q, @Param("department") String department, Pageable pageable);

    @Query("""
        SELECT u FROM User u
        WHERE u.deletedAt IS NULL
          AND COALESCE(u.systemAccount, false) = false
          AND ('ADMIN' NOT MEMBER OF u.roles)
          AND (LOCATE('archived_', u.accountId) <> 1)
          AND COALESCE(u.uebaScore, 100) < 100
        ORDER BY COALESCE(u.uebaScore, 100) ASC, COALESCE(u.updatedAt, u.createdAt) DESC
        """)
    List<User> findRecentNonDefaultUebaUsers(Pageable pageable);

    @Query("""
        SELECT u FROM User u
        WHERE u.deletedAt IS NULL
          AND COALESCE(u.systemAccount, false) = false
          AND ('ADMIN' NOT MEMBER OF u.roles)
          AND (LOCATE('archived_', u.accountId) <> 1)
          AND (:department IS NULL OR u.department = :department)
          AND (
            :hasQuery = false
            OR lower(u.accountId) LIKE concat('%', :query, '%')
            OR lower(u.fullName) LIKE concat('%', :query, '%')
          )
          AND (:includeAll = true OR COALESCE(u.uebaScore, 100) < 100)
        """)
    Page<User> searchUebaUsers(
        @Param("department") String department,
        @Param("query") String query,
        @Param("hasQuery") boolean hasQuery,
        @Param("includeAll") boolean includeAll,
        Pageable pageable
    );

    @Query(value = """
        SELECT COALESCE(MIN(COALESCE(u.ueba_score, 100)), 100)
        FROM users u
        WHERE u.deleted_at IS NULL
          AND COALESCE(u.system_account, false) = false
          AND u.account_id NOT LIKE 'archived_%'
          AND u.id NOT IN (
              SELECT ur.user_id FROM user_roles ur WHERE ur.role IN ('ADMIN', 'ROLE_ADMIN')
          )
        """, nativeQuery = true)
    Integer findGlobalUebaLowestScore();
}
