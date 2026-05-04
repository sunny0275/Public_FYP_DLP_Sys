package com.dlp.platform.dto.auth;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoginRequest {

    @NotBlank(message = "Account ID is required")
    private String accountId;

    @NotBlank(message = "Password is required")
    private String password;

    private String mfaCode; // Optional for first step, required for MFA-enabled users
}
