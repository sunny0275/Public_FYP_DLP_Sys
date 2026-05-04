package com.dlp.platform.dto.share;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Set;

/**
 * Request DTO for updating share recipients (add/remove)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateShareRecipientsRequest {

    private Set<Long> addRecipientIds;
    private Set<Long> removeRecipientIds;
}
