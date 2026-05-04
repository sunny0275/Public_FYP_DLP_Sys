package com.dlp.platform.service.dashboard;

import com.dlp.platform.dto.dashboard.*;
import com.dlp.platform.entity.AuditLog;
import com.dlp.platform.entity.User;
import com.dlp.platform.repository.AuditLogRepository;
import com.dlp.platform.service.admin.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DashboardService {

    private static final int ALERT_PAGE_SIZE = 50;
    private static final List<String> ALERT_RESULTS = Arrays.asList("WARNING", "FAILURE");
    private static final String UEBA_DISABLE_ACTION = "UEBA_DISABLE";

    private final UserService userService;
    private final AuditLogRepository auditLogRepository;

    public UserSummaryResponse getUserSummary(Long userId) {
        log.debug("Fetching user summary for user ID: {}", userId);
        User user = userService.findById(userId);
        Boolean passwordExpiringSoon = false;
        Integer daysUntilExpiry = null;
        if (user.getPasswordExpiryDate() != null) {
            long days = ChronoUnit.DAYS.between(LocalDateTime.now(), user.getPasswordExpiryDate());
            daysUntilExpiry = (int) days;
            passwordExpiringSoon = days <= 7 && days > 0;
        }
        return UserSummaryResponse.builder()
                .userId(user.getId())
                .accountId(user.getAccountId())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .department(user.getDepartment())
                .position(user.getPosition())
                .pendingTaskCount(0)
                .recentDocCount(0)
                .alertCount(countAlertsForUser(user.getId(), user.getRoles() != null && user.getRoles().contains("ADMIN")))
                .passwordExpiringSoon(passwordExpiringSoon)
                .daysUntilPasswordExpiry(daysUntilExpiry)
                .build();
    }

    private int countAlertsForUser(Long userId, boolean isAdmin) {
        try {
            List<AuditLog> list = isAdmin
                    ? auditLogRepository.findTop50AlertsOrderByTimestampDesc(ALERT_RESULTS, UEBA_DISABLE_ACTION, PageRequest.of(0, ALERT_PAGE_SIZE))
                    : auditLogRepository.findTop50AlertsForUserOrderByTimestampDesc(userId, ALERT_RESULTS, UEBA_DISABLE_ACTION, PageRequest.of(0, ALERT_PAGE_SIZE));
            return list.size();
        } catch (Exception e) {
            log.warn("Failed to count alerts for userId={}, isAdmin={}, fallback to 0. reason={}", userId, isAdmin, e.getMessage());
            return 0;
        }
    }

    public List<PendingTaskResponse> getPendingTasks(Long userId) {
        log.debug("Fetching pending tasks for user ID: {}", userId);
        return new ArrayList<>();
    }

    public List<RecentDocumentResponse> getRecentDocuments(Long userId) {
        log.debug("Fetching recent documents for user ID: {}", userId);
        return new ArrayList<>();
    }

    /**
     * Recent alerts for notifications: WARNING/FAILURE audit events and UEBA_DISABLE.
     * Admin sees all such events; normal user sees only their own (so they get notified of their own warnings too).
     */
    public List<AlertResponse> getRecentAlerts(Long userId) {
        log.debug("Fetching recent alerts for user ID: {}", userId);
        try {
            User user = userService.findById(userId);
            boolean isAdmin = user.getRoles() != null && user.getRoles().contains("ADMIN");
            List<AuditLog> logs = isAdmin
                    ? auditLogRepository.findTop50AlertsOrderByTimestampDesc(ALERT_RESULTS, UEBA_DISABLE_ACTION, PageRequest.of(0, ALERT_PAGE_SIZE))
                    : auditLogRepository.findTop50AlertsForUserOrderByTimestampDesc(userId, ALERT_RESULTS, UEBA_DISABLE_ACTION, PageRequest.of(0, ALERT_PAGE_SIZE));
            return logs.stream().map(this::toAlertResponse).collect(Collectors.toList());
        } catch (Exception e) {
            log.warn("Failed to fetch recent alerts for userId={}, fallback to empty list. reason={}", userId, e.getMessage());
            return new ArrayList<>();
        }
    }

    private AlertResponse toAlertResponse(AuditLog log) {
        String severity = "FAILURE".equalsIgnoreCase(log.getResult()) ? "HIGH" : "WARNING".equalsIgnoreCase(log.getResult()) ? "MEDIUM" : "LOW";
        if ("UEBA_DISABLE".equals(log.getAction())) severity = "HIGH";
        String details = log.getDetails();
        if (details != null && details.length() > 500) details = details.substring(0, 497) + "...";
        return AlertResponse.builder()
                .id(log.getId())
                .alertType(log.getAction())
                .severity(severity)
                .alertTime(log.getTimestamp())
                .description(details != null ? details : "")
                .resourceType(log.getCategory())
                .resourceId(log.getUserId() != null ? log.getUserId().toString() : null)
                .acknowledged(false)
                .build();
    }
}
