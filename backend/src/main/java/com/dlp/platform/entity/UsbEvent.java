package com.dlp.platform.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "usb_event")
@EntityListeners(AuditingEntityListener.class)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UsbEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * When the endpoint detected the USB event.
     */
    @Column(name = "event_time", nullable = false)
    private LocalDateTime eventTime;

    @Column(name = "username", length = 255)
    private String username;

    @Column(name = "host_name", length = 255)
    private String hostName;

    @Column(name = "host_group", length = 100)
    private String hostGroup;

    @Column(name = "user_role", length = 100)
    private String userRole;

    @Column(name = "department", length = 100)
    private String department;

    @Column(name = "device_id", length = 255)
    private String deviceId;

    @Column(name = "vendor_id", length = 50)
    private String vendorId;

    @Column(name = "product_id", length = 50)
    private String productId;

    @Column(name = "serial_number", length = 255)
    private String serialNumber;

    @Column(name = "volume_label", length = 255)
    private String volumeLabel;

    @Column(name = "capacity_bytes")
    private Long capacityBytes;

    @Column(name = "event_type", length = 50, nullable = false)
    private String eventType; // e.g. INSERTED / REMOVED

    @Column(name = "decided_action", length = 50, nullable = false)
    private String decidedAction; // e.g. BLOCK_MOUNT

    @Column(name = "decision_reason", length = 255)
    private String decisionReason;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}

