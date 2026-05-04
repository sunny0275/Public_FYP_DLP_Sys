package com.dlp.platform.dto.security;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * DTO sent by endpoint agent when a USB device is inserted/removed.
 * The backend will always decide to BLOCK_MOUNT (default deny) but records full context.
 */
@Data
public class UsbEventRequest {

    private LocalDateTime eventTime;

    private String username;
    private String hostName;
    private String hostGroup;
    private String userRole;
    private String department;

    private String deviceId;
    private String vendorId;
    private String productId;
    private String serialNumber;
    private String volumeLabel;
    private Long capacityBytes;

    private String eventType; // INSERTED / REMOVED
}

