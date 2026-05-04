package com.dlp.platform.controller.admin;

import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.dto.user.UserLookupResponse;
import com.dlp.platform.entity.User;
import com.dlp.platform.enums.Role;
import com.dlp.platform.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * User directory endpoints (non-admin) for UX features like realtime search suggestions.
 */
@RestController
@RequestMapping("/users")
@Slf4j
@RequiredArgsConstructor
public class UserDirectoryController {

    private final UserRepository userRepository;

    /**
     * Realtime search users by accountId / fullName / email.
     * GET /api/users/search?q=...
     */
    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<UserLookupResponse>>> searchUsers(
        @RequestParam(name = "q", required = false) String q,
        @RequestParam(name = "limit", required = false, defaultValue = "10") int limit,
        @AuthenticationPrincipal User currentUser
    ) {
        String query = q == null ? "" : q.trim();
        if (query.length() < 2) {
            return ResponseEntity.ok(ApiResponse.success("OK", Collections.emptyList()));
        }

        limit = Math.max(1, Math.min(limit, 20));

        boolean crossDept = hasCrossDepartmentAccess(currentUser);
        String dept = currentUser != null ? currentUser.getDepartment() : null;

        List<User> users;
        if (crossDept) {
            users = userRepository.searchActiveUsers(query.toLowerCase(Locale.ROOT), PageRequest.of(0, limit));
        } else {
            users = userRepository.searchActiveUsersInDepartment(query.toLowerCase(Locale.ROOT), dept, PageRequest.of(0, limit));
        }

        Long me = currentUser != null ? currentUser.getId() : null;

        List<UserLookupResponse> resp = users.stream()
            .filter(u -> me == null || !u.getId().equals(me))
            .map(UserLookupResponse::from)
            .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success("OK", resp));
    }

    private boolean hasCrossDepartmentAccess(User user) {
        if (user == null) return false;
        Set<String> roles = user.getRoles() != null ? user.getRoles() : Collections.emptySet();
        for (String r : roles) {
            String normalized = normalizeRole(r);
            try {
                Role role = Role.valueOf(normalized);
                if (role.hasCrossDepartmentalAccess()) return true;
            } catch (Exception ignored) {
            }
        }
        return false;
    }

    private String normalizeRole(String role) {
        if (role == null) return "";
        String r = role.trim().toUpperCase(Locale.ROOT);
        if (r.startsWith("ROLE_")) r = r.substring("ROLE_".length());
        return r;
    }
}


