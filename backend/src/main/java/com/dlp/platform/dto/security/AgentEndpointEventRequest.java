package com.dlp.platform.dto.security;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

/**
 * Payload sent by desktop endpoint agent (Electron) for security monitoring events.
 */
@Data
public class AgentEndpointEventRequest {

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
    private String accountId;
    private String hostName;
    private String ipAddress;
}

