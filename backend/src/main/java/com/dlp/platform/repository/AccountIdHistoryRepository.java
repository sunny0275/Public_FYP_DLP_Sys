package com.dlp.platform.repository;

import com.dlp.platform.entity.AccountIdHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface AccountIdHistoryRepository extends JpaRepository<AccountIdHistory, Long> {
    boolean existsByAccountId(String accountId);

    @Query("SELECT COUNT(h) FROM AccountIdHistory h WHERE h.accountId LIKE concat(:prefix, '%')")
    long countByPrefix(@Param("prefix") String prefix);
}


