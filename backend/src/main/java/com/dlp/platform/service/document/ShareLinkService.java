package com.dlp.platform.service.document;

import com.dlp.platform.dto.share.ShareLinkRequest;
import com.dlp.platform.dto.share.ShareLinkResponse;
import com.dlp.platform.dto.share.ShareRecipientInfo;
import com.dlp.platform.dto.share.UpdateShareRecipientsRequest;
import com.dlp.platform.dto.share.UpdateShareRequest;
import com.dlp.platform.entity.*;
import com.dlp.platform.repository.*;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.annotation.Transactional;
import com.dlp.platform.util.RoleUtils;
import com.dlp.platform.service.signature.SignatureService;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service for managing document sharing
 *
 * Features:
 * - Create internal/external share links
 * - Validate access permissions
 * - Enforce DLP policies
 * - Manage share lifecycle
 * - Audit all share activities
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ShareLinkService {

    private final ShareLinkRepository shareLinkRepository;
    private final DocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final DocumentActivityRepository activityRepository;
    private final SignatureRepository signatureRepository;
    private final SignatureService signatureService;
    private final TransactionTemplate transactionTemplate;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    /**
     * Create a new share link with DLP policy evaluation
     */
    @Transactional
    public ShareLinkResponse createShareLink(ShareLinkRequest request, User currentUser, String ipAddress) {
        log.info("Creating share link for document {} by user {}", request.getDocumentId(), currentUser.getAccountId());

        // Verify document exists and user has permission
        Document document = documentRepository.findById(request.getDocumentId())
            .orElseThrow(() -> new EntityNotFoundException("Document not found"));

        if (!canShare(document, currentUser)) {
            logActivity(document, currentUser, "SHARE_DENIED", "Permission denied", ipAddress);
            throw new AccessDeniedException("You do not have permission to share this document");
        }

        // Evaluate DLP policy
        boolean requiresApproval = evaluateSharePolicy(document, request, currentUser);

        // Create share link entity
        ShareLink shareLink = ShareLink.builder()
            .token(generateSecureToken())
            .document(document)
            .creator(currentUser)
            .shareType(request.getShareType())
            .permission(request.getPermission())
            .expiresAt(request.getExpiresAt())
            .accessLimit(request.getAccessLimit())
            .requiresWatermark(request.getRequiresWatermark() != null ? request.getRequiresWatermark() : true)
            .allowCopy(request.getAllowCopy() != null ? request.getAllowCopy() : false)
            .allowPrint(request.getAllowPrint() != null ? request.getAllowPrint() : false)
            .allowDownload(request.getAllowDownload() != null ? request.getAllowDownload() : false)
            .allowEdit(request.getAllowEdit() != null ? request.getAllowEdit() : false)
            .requiresApproval(requiresApproval)
            .status(requiresApproval ? ShareLink.ShareStatus.PENDING_APPROVAL : ShareLink.ShareStatus.ACTIVE)
            .build();

        // Handle recipients for internal sharing
        if (request.getShareType() == ShareLink.ShareType.INTERNAL) {
            if (request.getRecipientIds() == null || request.getRecipientIds().isEmpty()) {
                throw new IllegalArgumentException("Internal share requires at least one recipient");
            }

            // Enforce referential integrity at application level (and enable DB FK via JPA mapping)
            List<User> recipients = userRepository.findAllById(request.getRecipientIds());
            if (recipients.size() != request.getRecipientIds().size()) {
                // Identify missing IDs for a clear error message
                Set<Long> found = recipients.stream().map(User::getId).collect(Collectors.toSet());
                Set<Long> missing = request.getRecipientIds().stream()
                    .filter(id -> !found.contains(id))
                    .collect(Collectors.toSet());
                throw new EntityNotFoundException("Recipient user(s) not found: " + missing);
            }
            shareLink.setRecipients(new HashSet<>(recipients));
        }

        // Handle IP whitelist
        if (request.getIpWhitelist() != null && !request.getIpWhitelist().isEmpty()) {
            for (String ip : request.getIpWhitelist()) {
                shareLink.addToIpWhitelist(ip); // Validates IP format
            }
        }

        // Handle password protection
        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            String hashedPassword = passwordEncoder.encode(request.getPassword());
            shareLink.setPasswordHashBcrypt(hashedPassword);
        }

        ShareLink savedShare = shareLinkRepository.save(shareLink);

        // Log activity
        logActivity(document, currentUser, "SHARE_CREATED",
            "Share link created: " + shareLink.getShareType(), ipAddress);

        // Increment document share count
        documentRepository.incrementShareCount(document.getId());

        ShareLinkResponse response = ShareLinkResponse.from(savedShare);
        response.setDocumentName(document.getName());
        response.setCreatorName(currentUser.getFullName());
        response.setShareUrl(generateShareUrl(savedShare.getToken()));

        log.info("Share link created successfully: {}", savedShare.getId());
        return response;
    }

    /**
     * Access a shared document via token
     */
    @Transactional
    public ShareLinkResponse accessShareLink(String token, String password, String ipAddress, User currentUser) {
        log.info("Accessing share link with token: {}", token);

        ShareLink shareLink = shareLinkRepository.findByToken(token)
            .orElseThrow(() -> new EntityNotFoundException("Share link not found or expired"));

        // Validate accessibility
        if (!shareLink.isAccessible()) {
            String reason = getInaccessibleReason(shareLink);
            log.warn("Share link not accessible: {}", reason);
            throw new AccessDeniedException(reason);
        }

        // Validate IP address
        if (!shareLink.canAccessFromIp(ipAddress)) {
            log.warn("IP address {} not in whitelist", ipAddress);
            throw new AccessDeniedException("Access denied: IP address not authorized");
        }

        // Validate password if required
        if (shareLink.getPasswordHashBcrypt() != null) {
            if (password == null || !passwordEncoder.matches(password, shareLink.getPasswordHashBcrypt())) {
                log.warn("Invalid password attempt for share link {}", token);
                throw new AccessDeniedException("Invalid password");
            }
        }

        // INTERNAL shares require authenticated recipient
        if (shareLink.getShareType() == ShareLink.ShareType.INTERNAL) {
            if (currentUser == null) {
                throw new AccessDeniedException("Login required for internal shares");
            }
            if (shareLink.getRecipients() != null && !shareLink.getRecipients().isEmpty()) {
                boolean isRecipient = shareLink.getRecipients().stream()
                    .anyMatch(u -> u != null && u.getId() != null && u.getId().equals(currentUser.getId()));
                if (!isRecipient) {
                throw new AccessDeniedException("Access denied: you are not a recipient of this share");
                }
            }
        }

        // Increment access count atomically
        shareLinkRepository.incrementAccessCount(shareLink.getId(), LocalDateTime.now());

        Document document = documentRepository.findById(shareLink.getDocumentId())
            .orElseThrow(() -> new EntityNotFoundException("Document not found"));

        ShareLinkResponse response = ShareLinkResponse.from(shareLink);
        response.setDocumentName(document.getName());

        log.info("Share link accessed successfully");
        return response;
    }

    /**
     * Verify a share link without incrementing access counter.
     */
    @Transactional(readOnly = true)
    public ShareLinkResponse verifyShareLink(String token, String password, String ipAddress, User currentUser) {
        ShareLink shareLink = shareLinkRepository.findByToken(token)
            .orElseThrow(() -> new EntityNotFoundException("Share link not found or expired"));

        if (!shareLink.isAccessible()) {
            throw new AccessDeniedException(getInaccessibleReason(shareLink));
        }
        if (!shareLink.canAccessFromIp(ipAddress)) {
            throw new AccessDeniedException("Access denied: IP address not authorized");
        }
        if (shareLink.getPasswordHashBcrypt() != null) {
            if (password == null || !passwordEncoder.matches(password, shareLink.getPasswordHashBcrypt())) {
                throw new AccessDeniedException("Invalid password");
            }
        }
        if (shareLink.getShareType() == ShareLink.ShareType.INTERNAL) {
            if (currentUser == null) {
                throw new AccessDeniedException("Login required for internal shares");
            }
            if (shareLink.getRecipients() != null && !shareLink.getRecipients().isEmpty()) {
                boolean isRecipient = shareLink.getRecipients().stream()
                    .anyMatch(u -> u != null && u.getId() != null && u.getId().equals(currentUser.getId()));
                if (!isRecipient) {
                    throw new AccessDeniedException("Access denied: you are not a recipient of this share");
                }
            }
        }

        Document document = documentRepository.findById(shareLink.getDocumentId())
            .orElseThrow(() -> new EntityNotFoundException("Document not found"));
        ShareLinkResponse response = ShareLinkResponse.from(shareLink);
        response.setDocumentName(document.getName());
        return response;
    }

    /**
     * Revoke a share link
     */
    @Transactional
    public void revokeShareLink(Long shareLinkId, User currentUser, String reason, String ipAddress) {
        log.info("Revoking share link {} by user {}", shareLinkId, currentUser.getAccountId());

        ShareLink shareLink = shareLinkRepository.findById(shareLinkId)
            .orElseThrow(() -> new EntityNotFoundException("Share link not found"));

        // Verify permission to revoke
        if (!shareLink.getCreatorId().equals(currentUser.getId()) && !RoleUtils.isAdmin(currentUser.getRoles())) {
            throw new AccessDeniedException("You do not have permission to revoke this share link");
        }

        shareLink.revoke(currentUser.getId(), reason);
        shareLinkRepository.save(shareLink);

        // Log activity
        Document document = documentRepository.findById(shareLink.getDocumentId()).orElse(null);
        if (document != null) {
            logActivity(document, currentUser, "SHARE_REVOKED", "Share link revoked: " + reason, ipAddress);
        }

        log.info("Share link revoked successfully");
    }

    /**
     * Get all shares created by a user
     */
    @Transactional(readOnly = true)
    public Page<ShareLinkResponse> getUserShares(User currentUser, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<ShareLink> shares = shareLinkRepository.findByCreatorId(currentUser.getId(), pageable);

        return shares.map(share -> {
            ShareLinkResponse response = ShareLinkResponse.from(share);
            documentRepository.findById(share.getDocumentId()).ifPresent(doc ->
                response.setDocumentName(doc.getName())
            );
            response.setCreatorName(currentUser.getFullName());
            response.setShareUrl(generateShareUrl(share.getToken()));
            return response;
        });
    }

    /**
     * Get all shares for a document
     */
    @Transactional(readOnly = true)
    public List<ShareLinkResponse> getDocumentShares(Long documentId, User currentUser) {
        Document document = documentRepository.findById(documentId)
            .orElseThrow(() -> new EntityNotFoundException("Document not found"));

        // Verify permission
        if (!document.getOwner().getId().equals(currentUser.getId()) && !RoleUtils.isAdmin(currentUser.getRoles())) {
            throw new AccessDeniedException("You do not have permission to view shares for this document");
        }

        List<ShareLink> shares = shareLinkRepository.findByDocumentId(documentId);

        return shares.stream()
            .map(share -> {
                ShareLinkResponse response = ShareLinkResponse.from(share);
                response.setDocumentName(document.getName());
                userRepository.findById(share.getCreatorId()).ifPresent(creator ->
                    response.setCreatorName(creator.getFullName())
                );
                response.setShareUrl(generateShareUrl(share.getToken()));
                if (share.getRecipients() != null && !share.getRecipients().isEmpty()) {
                    List<ShareRecipientInfo> recipients = share.getRecipients().stream()
                        .map(u -> ShareRecipientInfo.builder()
                            .userId(u.getId())
                            .accountId(u.getAccountId())
                            .fullName(u.getFullName())
                            .department(u.getDepartment())
                            .build())
                        .collect(Collectors.toList());
                    response.setRecipients(recipients);
                }
                return response;
            })
            .collect(Collectors.toList());
    }

    /**
     * Update share recipients (add/remove)
     */
    @Transactional
    public ShareLinkResponse updateShareRecipients(Long shareLinkId, UpdateShareRecipientsRequest request,
                                                   User currentUser, String ipAddress) {
        ShareLink shareLink = shareLinkRepository.findById(shareLinkId)
            .orElseThrow(() -> new EntityNotFoundException("Share link not found"));

        if (!shareLink.getCreatorId().equals(currentUser.getId()) && !RoleUtils.isAdmin(currentUser.getRoles())) {
            throw new AccessDeniedException("You do not have permission to update this share");
        }

        if (shareLink.getShareType() != ShareLink.ShareType.INTERNAL) {
            throw new IllegalStateException("Only internal shares have recipients");
        }

        Set<User> recipients = shareLink.getRecipients() != null ? shareLink.getRecipients() : new HashSet<>();

        if (request.getRemoveRecipientIds() != null && !request.getRemoveRecipientIds().isEmpty()) {
            recipients.removeIf(u -> request.getRemoveRecipientIds().contains(u.getId()));
        }

        if (request.getAddRecipientIds() != null && !request.getAddRecipientIds().isEmpty()) {
            List<User> toAdd = userRepository.findAllById(request.getAddRecipientIds());
            recipients.addAll(toAdd);
        }

        shareLink.setRecipients(recipients);
        ShareLink saved = shareLinkRepository.save(shareLink);

        Document document = documentRepository.findById(shareLink.getDocumentId()).orElse(null);
        if (document != null) {
            logActivity(document, currentUser, "SHARE_UPDATED", "Recipients updated", ipAddress);
        }

        ShareLinkResponse response = ShareLinkResponse.from(saved);
        response.setDocumentName(document != null ? document.getName() : null);
        response.setCreatorName(currentUser.getFullName());
        response.setShareUrl(generateShareUrl(saved.getToken()));
        if (saved.getRecipients() != null) {
            response.setRecipients(saved.getRecipients().stream()
                .map(u -> ShareRecipientInfo.builder()
                    .userId(u.getId())
                    .accountId(u.getAccountId())
                    .fullName(u.getFullName())
                    .department(u.getDepartment())
                    .build())
                .collect(Collectors.toList()));
        }
        return response;
    }

    /**
     * Update share permission and DRM settings
     */
    @Transactional
    public ShareLinkResponse updateShare(Long shareLinkId, UpdateShareRequest request,
                                         User currentUser, String ipAddress) {
        ShareLink shareLink = shareLinkRepository.findById(shareLinkId)
            .orElseThrow(() -> new EntityNotFoundException("Share link not found"));

        if (!shareLink.getCreatorId().equals(currentUser.getId()) && !RoleUtils.isAdmin(currentUser.getRoles())) {
            throw new AccessDeniedException("You do not have permission to update this share");
        }

        if (request.getExpiresAt() != null) {
            shareLink.setExpiresAt(request.getExpiresAt());
        }
        if (request.getAccessLimit() != null) {
            shareLink.setAccessLimit(request.getAccessLimit());
        }
        if (request.getPermission() != null) {
            shareLink.setPermission(request.getPermission());
        }
        if (request.getAllowCopy() != null) {
            shareLink.setAllowCopy(request.getAllowCopy());
        }
        if (request.getAllowPrint() != null) {
            shareLink.setAllowPrint(request.getAllowPrint());
        }
        if (request.getAllowDownload() != null) {
            shareLink.setAllowDownload(request.getAllowDownload());
        }
        if (request.getAllowEdit() != null) {
            shareLink.setAllowEdit(request.getAllowEdit());
        }

        ShareLink saved = shareLinkRepository.save(shareLink);

        Document document = documentRepository.findById(shareLink.getDocumentId()).orElse(null);
        if (document != null) {
            logActivity(document, currentUser, "SHARE_UPDATED", "Permission updated", ipAddress);
        }

        ShareLinkResponse response = ShareLinkResponse.from(saved);
        response.setDocumentName(document != null ? document.getName() : null);
        userRepository.findById(saved.getCreatorId()).ifPresent(c ->
            response.setCreatorName(c.getFullName())
        );
        response.setShareUrl(generateShareUrl(saved.getToken()));
        if (saved.getRecipients() != null) {
            response.setRecipients(saved.getRecipients().stream()
                .map(u -> ShareRecipientInfo.builder()
                    .userId(u.getId())
                    .accountId(u.getAccountId())
                    .fullName(u.getFullName())
                    .department(u.getDepartment())
                    .build())
                .collect(Collectors.toList()));
        }
        return response;
    }

    /**
     * Approve a pending share link with e-signature
     */
    @Transactional
    public void approveShareLink(Long shareLinkId, User approver, String ipAddress) {
        log.info("Approving share link {} by user {}", shareLinkId, approver.getAccountId());

        boolean canApprove = RoleUtils.hasRole(approver.getRoles(), "ADMIN")
                || RoleUtils.hasRole(approver.getRoles(), "MANAGER")
                || RoleUtils.hasRole(approver.getRoles(), "REVIEWER");
        if (!canApprove) {
            throw new AccessDeniedException("Only ADMIN / MANAGER / REVIEWER can approve share links");
        }

        ShareLink shareLink = shareLinkRepository.findById(shareLinkId)
            .orElseThrow(() -> new EntityNotFoundException("Share link not found"));

        if (shareLink.getStatus() != ShareLink.ShareStatus.PENDING_APPROVAL) {
            throw new IllegalStateException("Share link is not pending approval");
        }

        Document document = documentRepository.findById(shareLink.getDocumentId()).orElse(null);

        // Create digital-signature for the approval action (non-critical, skip only if fails)
        // Each share approval creates a separate signature record, even if user has signed before
        if (document != null) {
            try {
                // Use TransactionTemplate to isolate the signature operation
                // so that if it fails, it won't roll back the share approval
                transactionTemplate.executeWithoutResult(status -> {
                    try {
                        String actionHash = String.format("APPROVE_SHARE:%d:%d:%s:%s:%d",
                            shareLinkId,
                            document.getId(),
                            approver.getAccountId(),
                            LocalDateTime.now().toString(),
                            System.currentTimeMillis()
                        );
                        // Generate SHA-256 hash for signing
                        java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
                        String hashHex = bytesToHex(digest.digest(actionHash.getBytes()));

                        signatureService.signDocument(
                            document.getId(),
                            hashHex,
                            approver.getId(),
                            null, // use server-managed key
                            ipAddress,
                            null, // no device fingerprint
                            null,  // no MFA code
                            "APPROVE_SHARE",
                            "Share Approval"
                        );
                        log.info("E-signature created for share approval: shareLinkId={}, approver={}", shareLinkId, approver.getAccountId());
                    } catch (Exception e) {
                        log.warn("Failed to create e-signature for share approval (non-critical): {}", e.getMessage());
                        throw new RuntimeException(e); // Re-throw to rollback isolated transaction
                    }
                });
            } catch (Exception e) {
                log.warn("Failed to create e-signature for share approval (non-critical), continuing: {}", e.getMessage());
            }
        } else {
            log.warn("Document not found for share link {}, skipping e-signature", shareLinkId);
        }

        shareLink.approve(approver.getId());
        shareLinkRepository.save(shareLink);

        if (document != null) {
            logActivity(document, approver, "SHARE_APPROVED", "Share link approved with e-signature", ipAddress);
        }

        log.info("Share link approved successfully");
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    /**
     * Reject a pending share link and optionally correct document classification level.
     */
    @Transactional
    public void rejectShareLink(Long shareLinkId, User reviewer, String reason, String correctedClassificationLevel, String ipAddress) {
        log.info("Rejecting share link {} by user {}", shareLinkId, reviewer.getAccountId());

        boolean canReview = RoleUtils.hasRole(reviewer.getRoles(), "ADMIN")
                || RoleUtils.hasRole(reviewer.getRoles(), "MANAGER")
                || RoleUtils.hasRole(reviewer.getRoles(), "REVIEWER");
        if (!canReview) {
            throw new AccessDeniedException("Only ADMIN / MANAGER / REVIEWER can reject share links");
        }

        ShareLink shareLink = shareLinkRepository.findById(shareLinkId)
                .orElseThrow(() -> new EntityNotFoundException("Share link not found"));

        if (shareLink.getStatus() != ShareLink.ShareStatus.PENDING_APPROVAL) {
            throw new IllegalStateException("Share link is not pending approval");
        }

        Document document = documentRepository.findById(shareLink.getDocumentId()).orElse(null);
        if (document != null && correctedClassificationLevel != null && !correctedClassificationLevel.isBlank()) {
            Document.ClassificationLevel level = Document.ClassificationLevel.valueOf(
                    correctedClassificationLevel.trim().toUpperCase(Locale.ROOT)
            );
            document.setClassificationLevel(level);
            String baseReason = document.getClassificationReason() != null ? document.getClassificationReason() : "";
            String append = " | Share approval rejected by " + reviewer.getAccountId()
                    + " with corrected level=" + level
                    + (reason != null && !reason.isBlank() ? ", reason=" + reason.trim() : "");
            document.setClassificationReason((baseReason + append).trim());
            documentRepository.save(document);
        }

        shareLink.setStatus(ShareLink.ShareStatus.APPROVAL_REJECTED);
        shareLink.setApprovalGranted(false);
        shareLink.setApprovedBy(reviewer.getId());
        shareLink.setApprovedAt(LocalDateTime.now());
        if (reason != null && !reason.isBlank()) {
            shareLink.setRevocationReason(reason.trim());
        }
        shareLinkRepository.save(shareLink);

        if (document != null) {
            String details = "Share link rejected"
                    + (reason != null && !reason.isBlank() ? ": " + reason.trim() : "")
                    + (correctedClassificationLevel != null && !correctedClassificationLevel.isBlank()
                    ? " | correctedLevel=" + correctedClassificationLevel.trim().toUpperCase(Locale.ROOT)
                    : "");
            logActivity(document, reviewer, "SHARE_REJECTED", details, ipAddress);
        }

        log.info("Share link rejected successfully");
    }

    /**
     * List pending-approval share links for admin/security review consoles.
     */
    @Transactional(readOnly = true)
    public Page<ShareLinkResponse> getPendingApprovalShares(User currentUser, int page, int size) {
        boolean canView = RoleUtils.hasRole(currentUser.getRoles(), "ADMIN")
                || RoleUtils.hasRole(currentUser.getRoles(), "MANAGER")
                || RoleUtils.hasRole(currentUser.getRoles(), "REVIEWER");
        if (!canView) {
            throw new AccessDeniedException("You do not have permission to view pending share approvals");
        }

        Pageable pageable = PageRequest.of(page, size);
        Page<ShareLink> pending = shareLinkRepository.findPendingApprovalShares(pageable);
        return pending.map(share -> {
            ShareLinkResponse response = ShareLinkResponse.from(share);
            documentRepository.findById(share.getDocumentId()).ifPresent(doc -> {
                response.setDocumentName(doc.getName());
                response.setDocumentClassificationLevel(doc.getClassificationLevel() != null ? doc.getClassificationLevel().name() : null);
            });
            userRepository.findById(share.getCreatorId()).ifPresent(creator -> response.setCreatorName(creator.getFullName()));
            response.setShareUrl(generateShareUrl(share.getToken()));
            if (share.getRecipients() != null && !share.getRecipients().isEmpty()) {
                response.setRecipients(share.getRecipients().stream()
                        .map(u -> ShareRecipientInfo.builder()
                                .userId(u.getId())
                                .accountId(u.getAccountId())
                                .fullName(u.getFullName())
                                .department(u.getDepartment())
                                .build())
                        .collect(Collectors.toList()));
            }
            return response;
        });
    }

    // Helper methods

    private boolean canShare(Document document, User user) {
        if (document == null || user == null || user.getId() == null || document.getOwner() == null) {
            return false;
        }
        // Owner-only sharing policy:
        // share recipients (and all non-owners) must not create onward shares.
        if (!document.getOwner().getId().equals(user.getId())) {
            return false;
        }
        // Owner still respects document-level sharing switch.
        return Boolean.TRUE.equals(document.getAllowShare());
    }

    private boolean evaluateSharePolicy(Document document, ShareLinkRequest request, User user) {
        // Strictly confidential documents require approval
        if (document.getClassificationLevel() == Document.ClassificationLevel.STRICTLY_CONFIDENTIAL) {
            return true;
        }

        // External sharing of confidential documents requires approval
        if (request.getShareType() == ShareLink.ShareType.EXTERNAL &&
            document.getClassificationLevel() == Document.ClassificationLevel.CONFIDENTIAL) {
            return true;
        }

        // No approval needed for internal sharing or lower classification
        return false;
    }

    private String generateSecureToken() {
        return UUID.randomUUID().toString().replace("-", "") +
               UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    }

    private String generateShareUrl(String token) {
        // In production, use actual domain from configuration
        return "https://dlp-platform.example.com/shares/" + token;
    }

    private String getInaccessibleReason(ShareLink shareLink) {
        if (shareLink.getStatus() != ShareLink.ShareStatus.ACTIVE) {
            return "Share link is " + shareLink.getStatus().toString().toLowerCase();
        }
        if (shareLink.isExpired()) {
            return "Share link has expired";
        }
        if (shareLink.isAccessLimitReached()) {
            return "Access limit has been reached";
        }
        if (shareLink.getRequiresApproval() && !shareLink.getApprovalGranted()) {
            return "Share link is pending approval";
        }
        return "Share link is not accessible";
    }

    private void logActivity(Document document, User user, String action, String details, String ipAddress) {
        DocumentActivity.ActivityType type = DocumentActivity.ActivityType.SHARE;
        if (action != null) {
            String prefix = action.split("_")[0];
            try {
                type = DocumentActivity.ActivityType.valueOf(prefix);
            } catch (IllegalArgumentException ignored) {
                // fallback to SHARE
            }
        }

        DocumentActivity.ActivityResult result =
            (action != null && action.contains("DENIED"))
                ? DocumentActivity.ActivityResult.DENIED
                : DocumentActivity.ActivityResult.SUCCESS;

        DocumentActivity activity = DocumentActivity.builder()
            .document(document)
            .user(user)
            .activityType(type)
            .result(result)
            .details(details)
            .ipAddress(ipAddress)
            .build();

        activityRepository.save(activity);
    }
}
