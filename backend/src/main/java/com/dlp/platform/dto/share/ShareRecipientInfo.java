package com.dlp.platform.dto.share;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Recipient info for share management display
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShareRecipientInfo {

    private Long userId;
    private String accountId;
    private String fullName;
    private String department;
}
