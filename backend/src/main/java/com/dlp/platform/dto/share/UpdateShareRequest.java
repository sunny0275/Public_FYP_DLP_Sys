package com.dlp.platform.dto.share;

import com.dlp.platform.entity.ShareLink;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Request DTO for updating share: extend expiry, change permission, DRM settings.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateShareRequest {

    /** New expiration time (extend or shorten). */
    private LocalDateTime expiresAt;
    /** New access limit (null = leave unchanged). */
    private Integer accessLimit;
    private ShareLink.SharePermission permission;
    private Boolean allowCopy;
    private Boolean allowPrint;
    private Boolean allowDownload;
    private Boolean allowEdit;
}
