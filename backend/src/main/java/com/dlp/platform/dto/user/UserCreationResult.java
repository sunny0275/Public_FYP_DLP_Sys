package com.dlp.platform.dto.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for user creation result containing both user info and initial password
 * Used to securely pass initial password without storing it in User entity
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserCreationResult {
    private Long userId;
    private String accountId;
    private String email;
    private String fullName;
    private String initialPassword; // Plain text initial password for one-time display
}
