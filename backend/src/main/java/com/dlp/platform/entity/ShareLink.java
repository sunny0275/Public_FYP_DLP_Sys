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
import java.util.HashSet;
import java.util.Set;

/**
 * ShareLink Entity - Represents a document share link (internal or external)
 *
 * Features:
 * - Internal sharing (share to system users)
 * - External sharing (generate public link with restrictions)
 * - Access control (read-only, downloadable, editable)
 * - Expiration and access limits
 * - IP whitelist and password protection
 * - Watermark and DRM enforcement
 * - Access audit trail
 */
@Entity
@Table(name = "share_links", indexes = {
    @Index(name = "idx_share_token", columnList = "token", unique = true),
    @Index(name = "idx_share_document", columnList = "document_id"),
    @Index(name = "idx_share_creator", columnList = "creator_id"),
    @Index(name = "idx_share_status", columnList = "status")
})
@EntityListeners(AuditingEntityListener.class)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShareLink {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String token; // Unique access token (UUID)

    /**
     * DB-level FK relationship for ERD + integrity.
     * Keep documentId field for compatibility with existing service/DTO code.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(
        name = "document_id",
        nullable = false,
        foreignKey = @ForeignKey(name = "fk_share_links_document")
    )
    private Document document;

    @Column(name = "document_id", nullable = false, insertable = false, updatable = false)
    private Long documentId; // Shared document ID (read-only mirror of FK)

    /**
     * DB-level FK relationship for ERD + integrity.
     * Keep creatorId field for compatibility with existing service/DTO code.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(
        name = "creator_id",
        nullable = false,
        foreignKey = @ForeignKey(name = "fk_share_links_creator")
    )
    private User creator;

    @Column(name = "creator_id", nullable = false, insertable = false, updatable = false)
    private Long creatorId; // User who created the share (read-only mirror of FK)

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ShareType shareType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SharePermission permission;

    // Internal share recipients
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "share_recipients",
        joinColumns = @JoinColumn(name = "share_id", foreignKey = @ForeignKey(name = "fk_share_recipients_share")),
        inverseJoinColumns = @JoinColumn(name = "user_id", foreignKey = @ForeignKey(name = "fk_share_recipients_user")),
        uniqueConstraints = @UniqueConstraint(name = "uk_share_recipients_share_user", columnNames = {"share_id", "user_id"})
    )
    @Builder.Default
    private Set<User> recipients = new HashSet<>();

    // External share restrictions
    @Column
    private LocalDateTime expiresAt;

    @Column
    private Integer accessLimit; // Maximum access count (null = unlimited)

    @Column(nullable = false)
    @Builder.Default
    private Integer accessCount = 0; // Current access count

    @Column(length = 60)
    private String passwordHashBcrypt; // BCrypt hash for password-protected links

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(
        name = "share_ip_whitelist",
        joinColumns = @JoinColumn(name = "share_id", foreignKey = @ForeignKey(name = "fk_share_ip_whitelist_share"))
    )
    @Column(name = "ip_address")
    @Builder.Default
    private Set<String> ipWhitelist = new HashSet<>();

    // DRM and watermark settings
    @Column(nullable = false)
    @Builder.Default
    private Boolean requiresWatermark = true;

    @Column(nullable = false)
    @Builder.Default
    private Boolean allowCopy = false;

    @Column(nullable = false)
    @Builder.Default
    private Boolean allowPrint = false;

    @Column(nullable = false)
    @Builder.Default
    private Boolean allowDownload = false;

    @Column(nullable = false)
    @Builder.Default
    private Boolean allowEdit = false;

    // Share status
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private ShareStatus status = ShareStatus.ACTIVE;

    @Column
    private LocalDateTime revokedAt;

    @Column
    private Long revokedBy;

    @Column(length = 500)
    private String revocationReason;

    // Approval workflow (for sensitive documents)
    @Column
    private Long approvalWorkflowId;

    @Column(nullable = false)
    @Builder.Default
    private Boolean requiresApproval = false;

    @Column(nullable = false)
    @Builder.Default
    private Boolean approvalGranted = false;

    @Column
    private LocalDateTime approvedAt;

    @Column
    private Long approvedBy;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    @Column
    private LocalDateTime lastAccessedAt;

    @Version
    private Long version; // Optimistic locking

    // Enums
    public enum ShareType {
        INTERNAL,  // Share to system users
        EXTERNAL   // Generate public link
    }

    public enum SharePermission {
        READ_ONLY,    // View only
        DOWNLOAD,     // View + download
        EDIT,         // View + download + edit
        FULL          // All permissions
    }

    public enum ShareStatus {
        ACTIVE,           // Active and accessible
        EXPIRED,          // Expired
        REVOKED,          // Manually revoked
        PENDING_APPROVAL, // Waiting for approval
        APPROVAL_REJECTED // Approval rejected
    }

    // Helper methods
    public boolean isExpired() {
        return expiresAt != null && LocalDateTime.now().isAfter(expiresAt);
    }

    public boolean isAccessLimitReached() {
        return accessLimit != null && accessCount >= accessLimit;
    }

    public boolean isAccessible() {
        return status == ShareStatus.ACTIVE
            && !isExpired()
            && !isAccessLimitReached()
            && (!requiresApproval || approvalGranted);
    }

    public boolean canAccessFromIp(String ipAddress) {
        return ipWhitelist.isEmpty() || ipWhitelist.contains(ipAddress);
    }

    // Note: incrementAccessCount should be handled via repository UPDATE query for thread-safety
    // See ShareLinkRepository.incrementAccessCount() for atomic implementation
    public void markAccessed() {
        this.lastAccessedAt = LocalDateTime.now();
    }

    public void revoke(Long revokedBy, String reason) {
        this.status = ShareStatus.REVOKED;
        this.revokedAt = LocalDateTime.now();
        this.revokedBy = revokedBy;
        this.revocationReason = reason;
    }

    public void approve(Long approvedBy) {
        this.approvalGranted = true;
        this.approvedAt = LocalDateTime.now();
        this.approvedBy = approvedBy;
        if (this.status == ShareStatus.PENDING_APPROVAL) {
            this.status = ShareStatus.ACTIVE;
        }
    }

    public void addToIpWhitelist(String ipAddress) {
        if (!isValidIpAddress(ipAddress)) {
            throw new IllegalArgumentException("Invalid IP address format: " + ipAddress);
        }
        this.ipWhitelist.add(ipAddress);
    }

    private boolean isValidIpAddress(String ip) {
        if (ip == null || ip.isBlank()) {
            return false;
        }

        // IPv4 pattern validation (strict format)
        String ipv4Pattern = "^((25[0-5]|(2[0-4]|1\\d|[1-9]|)\\d)\\.?\\b){4}$";

        // IPv6 pattern validation (simplified)
        String ipv6Pattern = "^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$";

        // Check format first (no DNS lookup to prevent SSRF)
        if (ip.matches(ipv4Pattern) || ip.matches(ipv6Pattern)) {
            return true;
        }

        return false;
    }

    public void setPasswordHashBcrypt(String passwordHashBcrypt) {
        // Validate BCrypt hash format ($2a$, $2b$, or $2y$ followed by cost and 53-char hash)
        if (passwordHashBcrypt != null && !passwordHashBcrypt.matches("^\\$2[aby]\\$\\d{2}\\$.{53}$")) {
            throw new IllegalArgumentException("Password must be properly hashed with BCrypt");
        }
        this.passwordHashBcrypt = passwordHashBcrypt;
    }
}
