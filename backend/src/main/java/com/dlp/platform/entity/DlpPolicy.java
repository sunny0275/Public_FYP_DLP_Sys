package com.dlp.platform.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/**
 * DLP Policy entity for storing policy configurations
 * Supports version control and rollback
 */
@Entity
@Table(name = "dlp_policies", indexes = {
    @Index(name = "idx_policy_key", columnList = "policyKey"),
    @Index(name = "idx_version", columnList = "version"),
    @Index(name = "idx_active", columnList = "active")
})
@EntityListeners(AuditingEntityListener.class)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DlpPolicy {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String policyKey; // e.g., "classification.confidence_threshold", "access.role_mapping"

    @Column(nullable = false, length = 50)
    private String category; // CLASSIFICATION, ACCESS_CONTROL, SHARING, EDR, ANOMALY_DETECTION

    @Lob
    @Column(columnDefinition = "TEXT")
    private String policyValue; // JSON string containing policy configuration

    @Column(nullable = false)
    @Builder.Default
    private Integer version = 1; // Version number for this policy key

    @Column(nullable = false)
    @Builder.Default
    private Boolean active = true; // Whether this version is currently active

    @Column(length = 500)
    private String description; // Description of this policy

    @Column(length = 100)
    private String changedBy; // Account ID of user who made the change

    @Column(length = 500)
    private String changeReason; // Reason for the change

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (updatedAt == null) {
            updatedAt = LocalDateTime.now();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
