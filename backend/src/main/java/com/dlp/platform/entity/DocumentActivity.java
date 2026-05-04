package com.dlp.platform.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "document_activities")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentActivity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id", nullable = false)
    private Document document;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private ActivityType activityType;

    @Column(length = 1000)
    private String details;

    @Column(length = 50)
    private String ipAddress;

    @Column(length = 500)
    private String deviceFingerprint;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ActivityResult result;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime timestamp;

    public enum ActivityType {
        VIEW,
        DOWNLOAD,
        UPLOAD,
        UPDATE,
        DELETE,
        SHARE,
        VERSION_RESTORE,
        CLASSIFICATION_OVERRIDE,
        EXPORT
    }

    public enum ActivityResult {
        SUCCESS,
        DENIED,
        FAILED
    }
}
