package com.dlp.platform.controller.admin;

import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Simple user summary metrics for Admin dashboard.
 */
@Slf4j
@RestController
@RequestMapping("/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserMetricsController {

    private final UserRepository userRepository;

    /**
     * GET /api/admin/users/summary
     */
    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getUserSummary() {
        try {
            // Count "listable" users (same as Admin Panel user table: not deleted, enabled, not system, exclude archived_*)
            long totalUsers = userRepository.countListableUsers();
            long activeUsers = totalUsers; // by definition
            long lockedUsers = userRepository.countLockedListableUsers();
            long newUsersLast7Days = userRepository.countNewListableUsersSince(LocalDateTime.now().minusDays(7));
            long mfaEnabledCount = userRepository.countMfaEnabledListableUsers();
            double mfaEnabledPercentage = totalUsers == 0 ? 0.0 : (mfaEnabledCount * 100.0 / totalUsers);

            List<Object[]> byDept = userRepository.countListableUsersByDepartment();
            List<Map<String, Object>> usersByDepartment = byDept.stream().map(row -> {
                String dept = row[0] != null ? row[0].toString() : "(Unassigned)";
                long cnt = ((Number) row[1]).longValue();
                Map<String, Object> m = new HashMap<>();
                m.put("department", dept);
                m.put("count", cnt);
                return m;
            }).toList();

            List<Object[]> byRole = userRepository.countListableUsersByRole();
            List<Map<String, Object>> usersByRole = byRole.stream().map(row -> {
                String role = row[0] != null ? row[0].toString() : "UNKNOWN";
                long cnt = ((Number) row[1]).longValue();
                Map<String, Object> m = new HashMap<>();
                m.put("role", role);
                m.put("count", cnt);
                return m;
            }).toList();

            Map<String, Object> data = new HashMap<>();
            data.put("totalUsers", totalUsers);
            data.put("activeUsers", activeUsers);
            data.put("lockedUsers", lockedUsers);
            data.put("newUsersLast7Days", newUsersLast7Days);
            data.put("mfaEnabledCount", mfaEnabledCount);
            data.put("mfaEnabledPercentage", mfaEnabledPercentage);
            data.put("usersByDepartment", usersByDepartment);
            data.put("usersByRole", usersByRole);
            data.put("uebaUsers", userRepository.findRecentNonDefaultUebaUsers(PageRequest.of(0, 20)).stream().map(u -> {
                Map<String, Object> m = new HashMap<>();
                m.put("userId", u.getId());
                m.put("accountId", u.getAccountId());
                m.put("fullName", u.getFullName());
                m.put("department", u.getDepartment());
                m.put("uebaScore", u.getUebaScore() != null ? u.getUebaScore() : 100);
                m.put("updatedAt", u.getUpdatedAt());
                m.put("accountEnabled", u.getAccountEnabled());
                return m;
            }).toList());

            return ResponseEntity.ok(ApiResponse.success("User summary fetched", data));
        } catch (Exception e) {
            log.error("Failed to fetch admin user summary", e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("Failed to fetch admin user summary", e.getMessage()));
        }
    }
}


