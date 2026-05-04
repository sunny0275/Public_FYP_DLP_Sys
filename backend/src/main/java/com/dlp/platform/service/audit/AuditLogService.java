package com.dlp.platform.service.audit;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditService auditService;

    public void log(Long userId, String action, String resourceType, String resourceId, String ipAddress, String details) {
        String category = mapCategory(resourceType);
        String normalizedDetails = details;
        if (resourceId != null && !resourceId.isBlank()) {
            normalizedDetails = (details == null || details.isBlank())
                ? "resourceId=" + resourceId
                : details + " | resourceId=" + resourceId;
        }

        auditService.logEvent(
            userId,
            null,
            action,
            category,
            inferResultFromAction(action, normalizedDetails),
            normalizedDetails,
            ipAddress,
            null,
            null
        );

        log.info("[AUDIT] userId={} action={} resourceType={} resourceId={} ip={} details={}",
                userId, action, resourceType, resourceId, ipAddress, details);
    }

    private String mapCategory(String resourceType) {
        if (resourceType == null) return "SYSTEM";
        String normalized = resourceType.trim().toLowerCase();
        return switch (normalized) {
            case "document", "signature", "share" -> "DOCUMENT";
            case "user", "admin" -> "ADMIN";
            case "auth" -> "AUTH";
            case "ueba" -> "UEBA";
            default -> "SYSTEM";
        };
    }

    private String inferResultFromAction(String action, String details) {
        String normalizedAction = action == null ? "" : action.trim().toUpperCase();
        if (normalizedAction.contains("FAILED")) {
            return "FAILURE";
        }
        if (normalizedAction.contains("WARNING")) {
            return "WARNING";
        }
        String normalizedDetails = details == null ? "" : details.toLowerCase();
        if (normalizedDetails.contains("failed") || normalizedDetails.contains("error")) {
            return "FAILURE";
        }
        return "SUCCESS";
    }
}
