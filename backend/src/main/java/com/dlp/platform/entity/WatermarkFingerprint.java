package com.dlp.platform.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "watermark_fingerprint",
    indexes = {
        @Index(name = "idx_watermark_payload_hash", columnList = "payloadHash"),
        @Index(name = "idx_watermark_short_code", columnList = "shortCode"),
        @Index(name = "idx_watermark_document_id", columnList = "documentId")
    }
)
@EntityListeners(AuditingEntityListener.class)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WatermarkFingerprint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64, unique = true)
    private String payloadHash;

    /** Deep watermark short code (≤7 chars); lookup by this for traceback. */
    @Column(length = 16)
    private String shortCode;

    @Column
    private Long userId;

    @Column(length = 128)
    private String deviceId;

    @Column
    private Long documentId;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}

