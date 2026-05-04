package com.dlp.platform.dto.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO for updating user profile (limited fields only)
 *
 * Allowed fields: email, fullName
 * Forbidden fields: roles, department, position, accountId (require admin)
 *
 * Validation:
 * - Email must be valid format and unique
 * - Full name must be 2-100 characters
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateProfileRequest {

    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    private String email;

    @NotBlank(message = "Full name is required")
    @Size(min = 2, max = 100, message = "Full name must be between 2 and 100 characters")
    private String fullName;

    // Note: roles, department, position NOT allowed here
    // Attempting to modify those fields should result in 403 Forbidden (admin only)
}
