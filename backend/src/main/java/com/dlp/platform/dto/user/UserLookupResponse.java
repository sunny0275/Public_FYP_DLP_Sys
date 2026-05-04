package com.dlp.platform.dto.user;

import com.dlp.platform.entity.User;
import lombok.Builder;
import lombok.Data;

/**
 * Lightweight user lookup DTO for realtime search suggestions (share dialog).
 * Avoids exposing sensitive fields.
 */
@Data
@Builder
public class UserLookupResponse {
    private Long id;
    private String accountId;
    private String email;
    private String fullName;
    private String department;
    private String position;

    public static UserLookupResponse from(User u) {
        if (u == null) return null;
        return UserLookupResponse.builder()
            .id(u.getId())
            .accountId(u.getAccountId())
            .email(u.getEmail())
            .fullName(u.getFullName())
            .department(u.getDepartment())
            .position(u.getPosition())
            .build();
    }
}
