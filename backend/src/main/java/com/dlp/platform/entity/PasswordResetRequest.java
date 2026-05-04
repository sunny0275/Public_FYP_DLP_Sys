package com.dlp.platform.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/**
 * Entity to track password reset requests from users
 * Users submit requests via /forgot-password, admins review and process them
 */
@Entity
@Table(name = "password_reset_requests", indexes = {
    // Index names must be unique within the same DB schema (PostgreSQL constraint).
    // Avoid collisions with other tables (e.g., users.idx_account_id).
    @Index(name = "idx_password_reset_requests_account_id", columnList = "accountId"),
    @Index(name = "idx_status", columnList = "status"),
    @Index(name = "idx_created_at", columnList = "createdAt")
})
@EntityListeners(AuditingEntityListener.class)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PasswordResetRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String accountId;

    @Column(nullable = false, length = 255)
    private String email;

    @Column(length = 45)
    private String ipAddress;

    @Column(length = 500)
    private String userAgent;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private RequestStatus status = RequestStatus.PENDING;

    @Column(length = 1000)
    private String adminNotes; // Admin can add notes when processing

    private Long processedByUserId; // Admin who processed the request

    private LocalDateTime processedAt;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public enum RequestStatus {
        PENDING,    // Waiting for admin review
        APPROVED,   // Admin approved, password reset
        REJECTED,   // Admin rejected the request
        EXPIRED     // Request expired (older than 7 days)
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}

