package com.dlp.platform.dto.security;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

/**
 * Request body for POST /api/security/events.
 * Events are written to the audit log. Use result=WARNING for yellow alerts (e.g. device/USB detection).
 * Supported action examples: SCREENSHOT_ATTEMPT, USB_DEVICE_DETECTED, PHYSICAL_DEVICE_CONNECTED, WINDOW_FOCUS_LOST, etc.
 */
@Data
public class SecurityEventRequest {

    @NotBlank
    private String action;

    @NotBlank
    private String category;

    @NotBlank
    @Pattern(regexp = "SUCCESS|WARNING|FAILURE", message = "result must be SUCCESS, WARNING, or FAILURE")
    private String result;

    // Optional: Override auto-assigned severity (defaults: FAILURE→HIGH, WARNING→MEDIUM, SUCCESS→LOW)
    // Set to HIGH for Sidecar events that need high severity regardless of result
    @Pattern(regexp = "LOW|MEDIUM|HIGH|CRITICAL", message = "severity must be LOW, MEDIUM, HIGH, or CRITICAL")
    private String severity;

    private String details;

    // Optional: For Electron events, specify which user to attribute the event to
    // This is used when the current authentication might not match the actual user (e.g., Electron main process events)
    private String accountId;

    // Optional: Client's real IP address (sent by frontend when behind Docker/proxy)
    // When provided, this takes precedence over server-detected IP for accurate audit logging
    private String clientIp;
}

