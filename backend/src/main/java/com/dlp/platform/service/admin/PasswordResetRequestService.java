package com.dlp.platform.service.admin;

import com.dlp.platform.entity.PasswordResetRequest;
import com.dlp.platform.entity.User;
import com.dlp.platform.repository.PasswordResetRequestRepository;
import com.dlp.platform.service.audit.AuditService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Service to manage password reset requests
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PasswordResetRequestService {

    private final PasswordResetRequestRepository repository;
    private final UserService userService;
    private final AuditService auditService;

    /**
     * Create a password reset request
     */
    @Transactional
    public PasswordResetRequest createRequest(String accountId, String email, HttpServletRequest request) {
        // Verify account ID and email match
        User user = userService.findByAccountId(accountId);
        
        if (!user.getEmail().equalsIgnoreCase(email)) {
            throw new IllegalArgumentException("Email does not match the account");
        }

        // Check if there's a recent pending request (within 24 hours)
        LocalDateTime oneDayAgo = LocalDateTime.now().minusHours(24);
        repository.findFirstByAccountIdAndStatusAndCreatedAtAfterOrderByCreatedAtDesc(
                accountId,
                PasswordResetRequest.RequestStatus.PENDING,
                oneDayAgo
        ).ifPresent(existing -> {
            throw new IllegalStateException("A password reset request is already pending. Please wait or contact administrator.");
        });

        // Create new request
        PasswordResetRequest resetRequest = PasswordResetRequest.builder()
                .accountId(accountId)
                .email(email)
                .ipAddress(getClientIp(request))
                .userAgent(getUserAgent(request))
                .status(PasswordResetRequest.RequestStatus.PENDING)
                .build();

        PasswordResetRequest saved = repository.save(resetRequest);
        log.info("Password reset request created for account: {}", accountId);

        // Log audit event
        auditService.logEvent(
                user.getId(),
                accountId,
                "PASSWORD_RESET_REQUEST",
                "AUTH",
                "SUCCESS",
                "User submitted password reset request",
                getClientIp(request),
                getUserAgent(request),
                null
        );

        return saved;
    }

    /**
     * Get pending requests (for admin)
     */
    public Page<PasswordResetRequest> getPendingRequests(Pageable pageable) {
        return repository.findByStatusOrderByCreatedAtDesc(
                PasswordResetRequest.RequestStatus.PENDING,
                pageable
        );
    }

    /**
     * Approve and process a password reset request
     */
    @Transactional
    public void approveRequest(Long requestId, Long adminUserId, String adminAccountId, String notes, HttpServletRequest request) {
        PasswordResetRequest resetRequest = repository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Password reset request not found"));

        if (resetRequest.getStatus() != PasswordResetRequest.RequestStatus.PENDING) {
            throw new IllegalStateException("Request is not pending");
        }

        // Reset password
        userService.resetPassword(userService.findByAccountId(resetRequest.getAccountId()).getId());

        // Update request status
        resetRequest.setStatus(PasswordResetRequest.RequestStatus.APPROVED);
        resetRequest.setProcessedByUserId(adminUserId);
        resetRequest.setProcessedAt(LocalDateTime.now());
        resetRequest.setAdminNotes(notes);
        repository.save(resetRequest);

        log.info("Password reset request {} approved by admin {}", requestId, adminAccountId);

        // Log audit event
        auditService.logUserModification(
                adminUserId,
                adminAccountId,
                resetRequest.getAccountId(),
                "Password reset request approved: " + notes,
                request
        );
    }

    /**
     * Reject a password reset request
     */
    @Transactional
    public void rejectRequest(Long requestId, Long adminUserId, String adminAccountId, String reason, HttpServletRequest request) {
        PasswordResetRequest resetRequest = repository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Password reset request not found"));

        if (resetRequest.getStatus() != PasswordResetRequest.RequestStatus.PENDING) {
            throw new IllegalStateException("Request is not pending");
        }

        resetRequest.setStatus(PasswordResetRequest.RequestStatus.REJECTED);
        resetRequest.setProcessedByUserId(adminUserId);
        resetRequest.setProcessedAt(LocalDateTime.now());
        resetRequest.setAdminNotes(reason);
        repository.save(resetRequest);

        log.info("Password reset request {} rejected by admin {}: {}", requestId, adminAccountId, reason);

        // Log audit event
        auditService.logEvent(
                adminUserId,
                adminAccountId,
                "PASSWORD_RESET_REJECT",
                "AUTH",
                "SUCCESS",
                "Rejected password reset request for: " + resetRequest.getAccountId() + " - Reason: " + reason,
                getClientIp(request),
                getUserAgent(request),
                null
        );
    }

    /**
     * Cleanup expired requests (older than 7 days)
     */
    @Scheduled(cron = "0 0 2 * * ?") // Run daily at 2 AM
    @Transactional
    public void cleanupExpiredRequests() {
        LocalDateTime sevenDaysAgo = LocalDateTime.now().minusDays(7);
        List<PasswordResetRequest> expired = repository.findByStatusAndCreatedAtBefore(
                PasswordResetRequest.RequestStatus.PENDING,
                sevenDaysAgo
        );

        expired.forEach(request -> {
            request.setStatus(PasswordResetRequest.RequestStatus.EXPIRED);
            repository.save(request);
        });

        if (!expired.isEmpty()) {
            log.info("Marked {} expired password reset requests", expired.size());
        }
    }

    private String getClientIp(HttpServletRequest request) {
        if (request == null) return "UNKNOWN";
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private String getUserAgent(HttpServletRequest request) {
        if (request == null) return "UNKNOWN";
        String userAgent = request.getHeader("User-Agent");
        return userAgent != null ? userAgent : "UNKNOWN";
    }
}

