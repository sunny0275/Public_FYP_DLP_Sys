package com.dlp.platform.dto.share;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO for rejecting a pending share approval.
 * Admin can optionally correct the document classification level at the same time.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RejectShareApprovalRequest {
    private String reason;
    private String correctedClassificationLevel; // PUBLIC / INTERNAL / CONFIDENTIAL / STRICTLY_CONFIDENTIAL
}

