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
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(name = "users", indexes = {
    @Index(name = "idx_account_id", columnList = "accountId"),
    @Index(name = "idx_email", columnList = "email")
})
@EntityListeners(AuditingEntityListener.class)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 50)
    private String accountId;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    private String hashedPassword;

    @Column(nullable = false)
    private String fullName;

    @Column(length = 100)
    private String department;

    @Column(length = 100)
    private String position;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "user_roles", joinColumns = @JoinColumn(name = "user_id"))
    @Column(name = "role")
    @Builder.Default
    private Set<String> roles = new HashSet<>();

    // MFA fields
    @Column(nullable = false)
    @Builder.Default
    private Boolean mfaEnabled = false;

    @Column(length = 32)
    private String mfaSecret;

    /**
     * Failed MFA verification attempts during login (separate from password/loginAttempts).
     * Reset on successful MFA verification or when lock expires.
     */
    @Column(nullable = false)
    @Builder.Default
    private Integer mfaLoginAttempts = 0;

    /**
     * Per-user signing key pair for "auto-sign" / non-interactive signing flows.
     *
     * - Private key is encrypted at rest using dlp.signature.key-encryption-secret (AES-GCM).
     * - Public key is stored as hex (X.509 SubjectPublicKeyInfo).
     *
     * NOTE: This changes the signing model from "derive key from password each time"
     * to "server-managed key per user" (requested to avoid re-entering password+MFA).
     */
    @Column(columnDefinition = "TEXT")
    private String signingPrivateKeyEnc;

    @Column(columnDefinition = "TEXT")
    private String signingPublicKeyHex;

    private LocalDateTime signingKeyCreatedAt;

    // Password policy fields
    @Column(nullable = false)
    @Builder.Default
    private Boolean firstLogin = true;

    @Column(nullable = false)
    @Builder.Default
    private Boolean passwordChangeRequired = true;

    private LocalDateTime passwordChangedAt;

    private LocalDateTime passwordExpiryDate;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "user_password_history", joinColumns = @JoinColumn(name = "user_id"))
    @Column(name = "password_hash")
    @OrderColumn(name = "history_order")
    @Builder.Default
    private List<String> passwordHistory = new ArrayList<>();

    // Account status fields
    @Column(nullable = false)
    @Builder.Default
    private Boolean accountLocked = false;

    private LocalDateTime accountLockedUntil;

    @Column(nullable = false)
    @Builder.Default
    private Integer loginAttempts = 0;

    /**
     * Account lockout level for exponential backoff.
     * Levels: 0=normal, 1=5min, 2=30min, 3=2hrs, 4=6hrs, 5=12hrs, 6=24hrs(permanent)
     */
    @Column(nullable = false)
    @Builder.Default
    private Integer accountLockLevel = 0;

    @Column(nullable = false)
    @Builder.Default
    private Boolean accountEnabled = true;

    // JWT token invalidation
    // Incremented when roles/permissions change to force re-login
    @Column(nullable = false)
    @Builder.Default
    private Integer tokenVersion = 1;

    /**
     * System-owned identities that must not be treated as real human users.
     * Example: archive identities used for referential integrity after employee departure.
     *
     * IMPORTANT: Exclude these from admin metrics (MFA adoption, users by dept/role) and normal user listings.
     */
    @Column(nullable = false)
    @Builder.Default
    private Boolean systemAccount = false;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    private LocalDateTime lastLoginAt;

    // Logical deletion timestamp (used for 30-day restore window)
    private LocalDateTime deletedAt;

    /**
     * UEBA risk score: 100 = full trust, deducted on anomaly. Every 10 points = tier (e.g. 90-100 OK, 80-90 warning, 0-50 disable).
     * Default 100 for new users; null treated as 100.
     */
    @Column(name = "ueba_score")
    private Integer uebaScore;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Helper methods
    public boolean isPasswordExpired() {
        return passwordExpiryDate != null && LocalDateTime.now().isAfter(passwordExpiryDate);
    }

    public boolean isPasswordExpiringSoon(int daysThreshold) {
        if (passwordExpiryDate == null) return false;
        return LocalDateTime.now().plusDays(daysThreshold).isAfter(passwordExpiryDate)
               && !isPasswordExpired();
    }

    public boolean isAccountLocked() {
        if (!accountLocked) return false;
        if (accountLockedUntil == null) return true; // Permanent lock

        if (LocalDateTime.now().isAfter(accountLockedUntil)) {
            accountLocked = false;
            accountLockedUntil = null;
            loginAttempts = 0;
            // Reset lock level when temporary lock expires (user can try again)
            // Only reset level if not permanently locked
            if (getAccountLockLevel() < MAX_ACCOUNT_LOCK_LEVEL) {
                accountLockLevel = 0;
            }
            return false;
        }
        return true;
    }

    public void incrementLoginAttempts() {
        this.loginAttempts = (this.loginAttempts == null ? 0 : this.loginAttempts) + 1;
    }

    public void resetLoginAttempts() {
        this.loginAttempts = 0;
        this.accountLocked = false;
        this.accountLockedUntil = null;
    }

    // Exponential backoff lockout durations in minutes: 5m, 30m, 2h, 6h, 12h, 24h
    private static final int[] ACCOUNT_LOCKOUT_DURATIONS = {5, 30, 120, 360, 720, 1440};
    public static final int MAX_ACCOUNT_LOCK_LEVEL = 6; // Permanent lockout

    /**
     * Lock account with exponential backoff based on current lock level.
     * Level 0-5: Temporary lock with increasing duration
     * Level 6: Permanent lock (requires admin intervention)
     */
    public void lockAccountWithLevel(int currentLevel) {
        this.accountLockLevel = currentLevel;
        if (currentLevel >= MAX_ACCOUNT_LOCK_LEVEL) {
            // Permanent lockout - accountLockedUntil = null means permanent
            this.accountLocked = true;
            this.accountLockedUntil = null;
        } else {
            int lockoutMinutes = ACCOUNT_LOCKOUT_DURATIONS[currentLevel];
            this.accountLocked = true;
            this.accountLockedUntil = LocalDateTime.now().plusMinutes(lockoutMinutes);
        }
    }

    public int getAccountLockLevel() {
        return this.accountLockLevel != null ? this.accountLockLevel : 0;
    }

    public boolean isPermanentlyLocked() {
        return accountLocked != null && accountLocked 
            && accountLockedUntil == null 
            && getAccountLockLevel() >= MAX_ACCOUNT_LOCK_LEVEL;
    }

    /**
     * @deprecated Use lockAccountWithLevel() instead for exponential backoff
     */
    @Deprecated
    public void lockAccount(int lockoutMinutes) {
        this.accountLocked = true;
        this.accountLockedUntil = LocalDateTime.now().plusMinutes(lockoutMinutes);
    }
}
