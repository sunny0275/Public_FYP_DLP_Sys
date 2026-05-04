package com.dlp.platform.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Set;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoginResponse {

    private String accessToken;
    private String refreshToken;
    private String tokenType;
    private Long expiresIn;

    // User information
    private Long userId;
    private String accountId;
    private String email;
    private String fullName;
    private Set<String> roles;
    private String department;
    private String position;

    // Available dashboards based on roles
    private Set<String> availableDashboards;

    // Status flags
    private boolean firstLogin;
    private boolean passwordChangeRequired;
    private boolean mfaRequired;
    private boolean mfaEnabled;
    private boolean passwordExpiringSoon;
    private Integer daysUntilPasswordExpiry;

    // If MFA setup is needed
    private String mfaQrCodeUrl;
    private String mfaQrCodeImage; // Base64-encoded PNG image data URL
    private String mfaSecret;
}
