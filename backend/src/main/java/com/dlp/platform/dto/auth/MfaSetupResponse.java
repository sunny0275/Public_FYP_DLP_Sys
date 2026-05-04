package com.dlp.platform.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MfaSetupResponse {

    private String secret;
    private String qrCodeUrl;
    private String qrCodeImage; // Base64-encoded PNG image data URL
    private boolean setupCompleted;
}
