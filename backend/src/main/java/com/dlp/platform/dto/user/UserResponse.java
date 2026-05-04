package com.dlp.platform.dto.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Set;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {

    private Long id;
    private String accountId;
    private String email;
    private String fullName;
    private String department;
    private Set<String> roles;
    private Boolean mfaEnabled;
    private Boolean accountEnabled;
    private Boolean accountLocked;
    private LocalDateTime createdAt;
    private LocalDateTime lastLoginAt;
    private LocalDateTime passwordExpiryDate;
    private Boolean passwordExpiringSoon;
    private LocalDateTime deletedAt;
}
