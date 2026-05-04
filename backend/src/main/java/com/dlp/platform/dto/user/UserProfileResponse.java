package com.dlp.platform.dto.user;

import com.dlp.platform.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Set;

/**
 * Response DTO for user profile (read-only roles/dept/position)
 *
 * Fields:
 * - Editable (via PUT /api/me): email, fullName
 * - Read-only (require admin): accountId, roles, department, position
 * - Status fields: accountEnabled, mfaEnabled, passwordExpiryDate, etc.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserProfileResponse {

    // Editable fields (can be modified via PUT /api/me)
    private String email;
    private String fullName;

    // Read-only fields (displayed but cannot be modified via /api/me)
    private String accountId;
    private Set<String> roles;
    private String department;
    private String position;

    // Status fields (read-only)
    private Boolean accountEnabled;
    private Boolean mfaEnabled;
    private LocalDateTime passwordExpiryDate;
    private LocalDateTime lastLoginAt;
    private LocalDateTime createdAt;

    /**
     * Convert User entity to UserProfileResponse
     *
     * @param user User entity
     * @return UserProfileResponse DTO
     */
    public static UserProfileResponse from(User user) {
        return UserProfileResponse.builder()
            .accountId(user.getAccountId())
            .email(user.getEmail())
            .fullName(user.getFullName())
            .roles(user.getRoles())
            .department(user.getDepartment())
            .position(user.getPosition())
            .accountEnabled(user.getAccountEnabled())
            .mfaEnabled(user.getMfaEnabled())
            .passwordExpiryDate(user.getPasswordExpiryDate())
            .lastLoginAt(user.getLastLoginAt())
            .createdAt(user.getCreatedAt())
            .build();
    }
}
