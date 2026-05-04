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
 * UEBA rule: risk scoring, anomaly detection, response action, or feature weight.
 * Condition and scope stored as JSON; see Phase04-UEBA-Rules.md.
 */
@Entity
@Table(name = "ueba_rules", indexes = {
    @Index(name = "idx_ueba_rule_type", columnList = "ruleType"),
    @Index(name = "idx_ueba_rule_enabled", columnList = "enabled"),
    @Index(name = "idx_ueba_rule_priority", columnList = "priority")
})
@EntityListeners(AuditingEntityListener.class)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UebaRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 1000)
    private String description;

    /** RISK_SCORING | ANOMALY_DETECTION | RESPONSE | FEATURE_WEIGHT */
    @Column(nullable = false, length = 32)
    private String ruleType;

    /** JSON: e.g. {"feature":"audit_failures","operator":"GT","value":2} or {"scoreBand":"HIGH","min":61,"max":80} */
    @Lob
    @Column(columnDefinition = "TEXT")
    private String conditionJson;

    /** For RISK_SCORING / FEATURE_WEIGHT: numeric contribution. For RESPONSE: action name stored here. */
    @Column(length = 64)
    private String actionOrWeight;

    /** Numeric weight for RISK_SCORING (stored separately for easy query); null for non-scoring rules. */
    private Double weight;

    /** For ANOMALY_DETECTION: LOW | MEDIUM | HIGH | CRITICAL */
    @Column(length = 20)
    private String severity;

    /** Optional scope JSON: {"roles":["ADMIN"],"departments":["IT"]} */
    @Lob
    @Column(columnDefinition = "TEXT")
    private String scopeJson;

    @Column(nullable = false)
    @Builder.Default
    private Integer priority = 100;

    @Column(nullable = false)
    @Builder.Default
    private Boolean enabled = true;

    @Column(nullable = false)
    @Builder.Default
    private Integer version = 1;

    @Column(length = 100)
    private String changedBy;

    @Column(length = 500)
    private String changeReason;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
