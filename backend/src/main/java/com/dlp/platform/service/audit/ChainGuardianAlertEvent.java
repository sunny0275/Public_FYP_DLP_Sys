package com.dlp.platform.service.audit;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

/**
 * Event published when AuditChainGuardian detects critical violations.
 * This event is handled asynchronously to avoid circular dependency issues.
 */
@Getter
public class ChainGuardianAlertEvent extends ApplicationEvent {

    private final String trigger;
    private final String severity;
    private final int criticalCount;
    private final int recoverableCount;
    private final String details;
    private final String userId;
    private final String accountId;

    public ChainGuardianAlertEvent(Object source, String trigger, String severity,
                                   int criticalCount, int recoverableCount, String details,
                                   String userId, String accountId) {
        super(source);
        this.trigger = trigger;
        this.severity = severity;
        this.criticalCount = criticalCount;
        this.recoverableCount = recoverableCount;
        this.details = details;
        this.userId = userId;
        this.accountId = accountId;
    }
}
