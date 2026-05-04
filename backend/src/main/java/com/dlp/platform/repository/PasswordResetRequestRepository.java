package com.dlp.platform.repository;

import com.dlp.platform.entity.PasswordResetRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface PasswordResetRequestRepository extends JpaRepository<PasswordResetRequest, Long> {

    /**
     * Find pending requests
     */
    Page<PasswordResetRequest> findByStatusOrderByCreatedAtDesc(
            PasswordResetRequest.RequestStatus status,
            Pageable pageable
    );

    /**
     * Find requests by account ID
     */
    List<PasswordResetRequest> findByAccountIdOrderByCreatedAtDesc(String accountId);

    /**
     * Find recent pending request for account (within last 24 hours)
     */
    Optional<PasswordResetRequest> findFirstByAccountIdAndStatusAndCreatedAtAfterOrderByCreatedAtDesc(
            String accountId,
            PasswordResetRequest.RequestStatus status,
            LocalDateTime after
    );

    /**
     * Find expired requests (older than specified days)
     */
    List<PasswordResetRequest> findByStatusAndCreatedAtBefore(
            PasswordResetRequest.RequestStatus status,
            LocalDateTime before
    );
}

