package com.dlp.platform.controller.edr;

import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.dto.security.UsbEventRequest;
import com.dlp.platform.entity.UsbEvent;
import com.dlp.platform.repository.UsbEventRepository;
import com.dlp.platform.service.audit.AuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Endpoint for EDR/DLP agents to report USB events.
 *
 * Security policy: default deny – all USB mass storage is considered BLOCK_MOUNT.
 * This controller records detailed USB context in usb_event and a high-level entry in audit_log.
 */
@Slf4j
@RestController
@RequestMapping("/agent/usb")
@RequiredArgsConstructor
public class UsbAgentController {

    private static final String ACTION_BLOCK = "BLOCK_MOUNT";

    private final UsbEventRepository usbEventRepository;
    private final AuditService auditService;

    /**
     * POST /agent/usb/events
     *
     * Called by endpoint agent when a USB storage device is detected.
     * The backend always decides to block (default deny) but returns the decision
     * so the agent can enforce it consistently.
     */
    @PostMapping("/events")
    public ResponseEntity<ApiResponse<Map<String, String>>> reportUsbEvent(@RequestBody UsbEventRequest request) {
        LocalDateTime eventTime = request.getEventTime() != null ? request.getEventTime() : LocalDateTime.now();

        UsbEvent event = UsbEvent.builder()
                .eventTime(eventTime)
                .username(request.getUsername())
                .hostName(request.getHostName())
                .hostGroup(request.getHostGroup())
                .userRole(request.getUserRole())
                .department(request.getDepartment())
                .deviceId(request.getDeviceId())
                .vendorId(request.getVendorId())
                .productId(request.getProductId())
                .serialNumber(request.getSerialNumber())
                .volumeLabel(request.getVolumeLabel())
                .capacityBytes(request.getCapacityBytes())
                .eventType(request.getEventType() != null ? request.getEventType() : "INSERTED")
                .decidedAction(ACTION_BLOCK)
                .decisionReason("Default policy: block all USB mass storage.")
                .build();

        usbEventRepository.save(event);

        // High-level immutable audit log entry (category = USB)
        String details = String.format(
                "USB %s blocked: user=%s host=%s deviceId=%s vendorId=%s productId=%s serial=%s volume=%s capacity=%s",
                event.getEventType(),
                nullToUnknown(event.getUsername()),
                nullToUnknown(event.getHostName()),
                nullToUnknown(event.getDeviceId()),
                nullToUnknown(event.getVendorId()),
                nullToUnknown(event.getProductId()),
                nullToUnknown(event.getSerialNumber()),
                nullToUnknown(event.getVolumeLabel()),
                event.getCapacityBytes() != null ? event.getCapacityBytes() : "UNKNOWN"
        );

        // No authenticated user context (agent call), so userId=null, accountId="AGENT"
        auditService.logEvent(
                null,
                "AGENT",
                "USB_BLOCKED",
                "USB",
                "SUCCESS",
                details,
                null,
                null,
                null
        );

        Map<String, String> decision = Map.of(
                "action", ACTION_BLOCK,
                "reason", "Default policy: block all USB mass storage."
        );

        log.info("USB event recorded and blocked: {}", details);
        return ResponseEntity.ok(ApiResponse.success("USB event recorded (default BLOCK_MOUNT)", decision));
    }

    private String nullToUnknown(Object value) {
        return value == null ? "UNKNOWN" : String.valueOf(value);
    }
}

