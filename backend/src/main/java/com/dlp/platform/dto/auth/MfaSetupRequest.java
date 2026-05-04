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
public class MfaSetupRequest {

    @NotBlank(message = "MFA code is required")
    private String code;

    private String secret; // Sent from frontend for verification
}
