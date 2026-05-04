package com.dlp.platform.dto.share;

import com.dlp.platform.entity.ShareLink;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Set;

/**
 * Request DTO for creating a share link
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShareLinkRequest {

    @NotNull(message = "Document ID is required")
    private Long documentId;

    @NotNull(message = "Share type is required")
    private ShareLink.ShareType shareType; // INTERNAL or EXTERNAL

    @NotNull(message = "Permission is required")
    private ShareLink.SharePermission permission; // READ_ONLY, DOWNLOAD, EDIT, FULL

    // For internal sharing
    private Set<Long> recipientIds;

    // For external sharing
    @Future(message = "Expiration date must be in the future")
    private LocalDateTime expiresAt;

    private Integer accessLimit; // Maximum access count

    private Set<String> ipWhitelist; // IP address restrictions

    private String password; // Plain password (will be hashed)

    private Boolean requiresWatermark;

    private Boolean allowCopy;

    private Boolean allowPrint;

    private Boolean allowDownload;

    private Boolean allowEdit;

    private String description; // Optional description of the share
}
