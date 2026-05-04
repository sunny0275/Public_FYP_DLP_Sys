package com.dlp.platform.dto.share;

import com.dlp.platform.entity.ShareLink;
import com.dlp.platform.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Response DTO for share link details
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShareLinkResponse {

    private Long id;
    private String token;
    private Long documentId;
    private String documentName;
    private String documentClassificationLevel;
    private Long creatorId;
    private String creatorName;
    private ShareLink.ShareType shareType;
    private ShareLink.SharePermission permission;
    private Set<Long> recipientIds;
    private List<ShareRecipientInfo> recipients;
    private LocalDateTime expiresAt;
    private Integer accessLimit;
    private Integer accessCount;
    private Boolean requiresPassword;
    private Set<String> ipWhitelist;
    private Boolean requiresWatermark;
    private Boolean allowCopy;
    private Boolean allowPrint;
    private Boolean allowDownload;
    private Boolean allowEdit;
    private ShareLink.ShareStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime lastAccessedAt;
    private Boolean requiresApproval;
    private Boolean approvalGranted;
    private LocalDateTime approvedAt;
    private Long approvedBy;

    // Full share URL
    private String shareUrl;

    public static ShareLinkResponse from(ShareLink shareLink) {
        return ShareLinkResponse.builder()
            .id(shareLink.getId())
            .token(shareLink.getToken())
            .documentId(shareLink.getDocumentId())
            .creatorId(shareLink.getCreatorId())
            .shareType(shareLink.getShareType())
            .permission(shareLink.getPermission())
            .recipientIds(
                shareLink.getRecipients() == null
                    ? null
                    : shareLink.getRecipients().stream()
                        .map(User::getId)
                        .collect(Collectors.toSet())
            )
            .expiresAt(shareLink.getExpiresAt())
            .accessLimit(shareLink.getAccessLimit())
            .accessCount(shareLink.getAccessCount())
            .requiresPassword(shareLink.getPasswordHashBcrypt() != null)
            .ipWhitelist(shareLink.getIpWhitelist())
            .requiresWatermark(shareLink.getRequiresWatermark())
            .allowCopy(shareLink.getAllowCopy())
            .allowPrint(shareLink.getAllowPrint())
            .allowDownload(shareLink.getAllowDownload())
            .allowEdit(shareLink.getAllowEdit())
            .status(shareLink.getStatus())
            .createdAt(shareLink.getCreatedAt())
            .lastAccessedAt(shareLink.getLastAccessedAt())
            .requiresApproval(shareLink.getRequiresApproval())
            .approvalGranted(shareLink.getApprovalGranted())
            .approvedAt(shareLink.getApprovedAt())
            .approvedBy(shareLink.getApprovedBy())
            .build();
    }
}
