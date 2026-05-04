package com.dlp.platform.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Keeps a permanent record of used accountIds to prevent re-use after purge/hard delete.
 * This is important for auditability and to avoid identity confusion (e.g., reusing a departed employee's accountId).
 */
@Entity
@Table(name = "account_id_history", indexes = {
    @Index(name = "idx_account_id_history_account_id", columnList = "accountId")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AccountIdHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String accountId;

    @Column(length = 100)
    private String reason; // e.g. "USER_CREATED", "USER_ARCHIVED", "USER_PURGED"

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}


