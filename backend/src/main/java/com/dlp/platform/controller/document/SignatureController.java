package com.dlp.platform.controller.document;

import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.entity.Document;
import com.dlp.platform.entity.SignatureRecord;
import com.dlp.platform.entity.User;
import com.dlp.platform.repository.DocumentRepository;
import com.dlp.platform.service.signature.SignatureService;
import com.dlp.platform.util.X509Utils;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST Controller for digital signature operations
 *
 * Endpoints:
 * - POST /api/sign - Sign document with ECDSA
 * - GET /api/sign/{docId}/chain - Get signature chain for document
 * - POST /api/sign/verify - Verify signature authenticity
 */
@RestController
@RequestMapping("/sign")
@Slf4j
@RequiredArgsConstructor
public class SignatureController {

    private final SignatureService signatureService;
    private final DocumentRepository documentRepository;

    /**
     * Sign a document with ECDSA signature
     * POST /api/sign
     *
     * IMPORTANT: If blockchain anchoring fails, the operation is rolled back
     * and the user must retry. The error message will indicate "try again".
     */
    @PostMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> signDocument(
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest httpRequest) {
        try {
            Long documentId = Long.valueOf(request.get("documentId").toString());
            String documentHash = (String) request.get("documentHash");
            String privateKeyHex = request.containsKey("privateKeyHex") ? (String) request.get("privateKeyHex") : null;
            String mfaCode = request.containsKey("mfaCode") ? (String) request.get("mfaCode") : null;
            String deviceFingerprint = httpRequest.getHeader("X-Device-Fingerprint");

            if (documentHash == null) {
                return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Missing required field: documentHash"));
            }

            String ipAddress = httpRequest.getRemoteAddr();
            SignatureRecord signature = signatureService.signDocument(
                documentId,
                documentHash,
                currentUser.getId(),
                privateKeyHex,
                ipAddress,
                deviceFingerprint,
                mfaCode
            );

            Map<String, Object> responseData = Map.of(
                "signatureId", signature.getId(),
                "documentId", signature.getDocumentId(),
                "signedAt", signature.getSignedAt().toString(),
                "timestampToken", signature.getTimestampToken(),
                "blockchainTxHash", signature.getBlockchainTxHash() != null ? signature.getBlockchainTxHash() : "",
                "status", "SIGNED"
            );

            return ResponseEntity.ok(ApiResponse.success("Document signed successfully", responseData));
            
        } catch (IllegalStateException e) {
            String message = e.getMessage();
            log.warn("Signature failed: {}", message);
            
            // Check if this is a retryable error (blockchain failed)
            if (message != null && (
                message.contains("blockchain") || 
                message.contains("Blockchain") ||
                message.contains("anchoring failed") ||
                message.contains("retry") ||
                message.contains("try again"))) {
                // This is a retryable error - user should try again
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(ApiResponse.error("Signing failed: " + message + ". Please try again."));
            }
            
            // Other IllegalStateException (e.g., already signed)
            return ResponseEntity.badRequest()
                .body(ApiResponse.error(message));
                
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("Error signing document", e);
            
            // Check for retryable errors
            String message = e.getMessage();
            if (message != null && (
                message.contains("blockchain") ||
                message.contains("Blockchain") ||
                message.contains("anchor"))) {
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(ApiResponse.error("Signing failed: " + message + ". Please try again."));
            }
            
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to sign document: " + e.getMessage()));
        }
    }

    /**
     * Get signature chain for a document
     * GET /api/sign/{docId}/chain
     */
    @GetMapping("/{docId}/chain")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getSignatureChain(
            @PathVariable Long docId,
            @AuthenticationPrincipal User currentUser) {
        try {
            List<SignatureRecord> chain = signatureService.getSignatureChain(docId);

            List<Map<String, Object>> chainData = new java.util.ArrayList<>();
            for (int i = 0; i < chain.size(); i++) {
                SignatureRecord sig = chain.get(i);
                Map<String, Object> sigData = new java.util.HashMap<>();
                sigData.put("id", sig.getId());
                sigData.put("documentId", sig.getDocumentId());
                sigData.put("userId", sig.getUserId());
                sigData.put("signedAt", sig.getSignedAt().toString());
                sigData.put("signatureHex", sig.getSignatureHex());
                sigData.put("publicKeyHex", sig.getPublicKeyHex() != null ? sig.getPublicKeyHex() : "");
                sigData.put("certificatePem", sig.getCertificatePem() != null ? sig.getCertificatePem() : "");
                sigData.put("issuerCertificatePem", sig.getIssuerCertificatePem() != null ? sig.getIssuerCertificatePem() : "");
                sigData.put("certificateSerialHex", sig.getCertificateSerialHex() != null ? sig.getCertificateSerialHex() : "");

                // Enterprise PKI summary (parsed from leaf certificate)
                if (sig.getCertificatePem() != null && !sig.getCertificatePem().isBlank()) {
                    try {
                        var cert = X509Utils.parsePemCertificate(sig.getCertificatePem());
                        sigData.put("pki", X509Utils.toEnterpriseSummary(cert));
                    } catch (Exception e) {
                        // Don't break response on parse errors
                        sigData.put("pki", java.util.Map.of("error", "Failed to parse certificate: " + e.getMessage()));
                    }
                }
                sigData.put("documentHash", sig.getDocumentHash());
                sigData.put("timestampToken", sig.getTimestampToken());
                sigData.put("blockchainTxHash", sig.getBlockchainTxHash() != null ? sig.getBlockchainTxHash() : "");
                sigData.put("status", sig.getStatus().toString());
                sigData.put("ipAddress", sig.getIpAddress() != null ? sig.getIpAddress() : "");
                sigData.put("deviceFingerprint", sig.getDeviceFingerprint() != null ? sig.getDeviceFingerprint() : "");
                sigData.put("revocationReason", sig.getRevocationReason() != null ? sig.getRevocationReason() : "");

                // Parse signature type from documentHash for better UI display
                String docHash = sig.getDocumentHash();
                String signatureType = sig.getSignatureType() != null ? sig.getSignatureType() : "UPLOAD";
                String signatureTypeLabel = sig.getSignatureType() != null ? sig.getSignatureType().replace('_', ' ') : "Document Upload";
                int badgeColor = 0xFF2196F3; // blue for upload
                
                // If no signatureType stored, try to infer from documentHash (legacy support)
                if (sig.getSignatureType() == null && docHash != null && docHash.contains("|")) {
                    String[] parts = docHash.split("\\|", 2);
                    String inferredType = parts[0];
                    signatureType = inferredType;
                    switch (inferredType) {
                        case "CLASSIFICATION_APPROVE":
                            signatureTypeLabel = "Classification Approval";
                            badgeColor = 0xFFFF9800; // orange
                            break;
                        case "APPROVE_SHARE":
                            signatureTypeLabel = "Share Approval";
                            badgeColor = 0xFF9C27B0; // purple
                            break;
                        case "MANUAL_SIGN":
                            signatureTypeLabel = "Manual Signature";
                            badgeColor = 0xFF00BCD4; // cyan
                            break;
                        default:
                            signatureTypeLabel = inferredType;
                    }
                } else {
                    // Use stored signatureType for colors
                    switch (signatureType) {
                        case "CLASSIFICATION_APPROVE":
                            badgeColor = 0xFFFF9800; // orange
                            signatureTypeLabel = "Classification Approval";
                            break;
                        case "APPROVE_SHARE":
                            badgeColor = 0xFF9C27B0; // purple
                            signatureTypeLabel = "Share Approval";
                            break;
                        case "MANUAL_SIGN":
                            badgeColor = 0xFF00BCD4; // cyan
                            signatureTypeLabel = "Manual Signature";
                            break;
                        case "UPLOAD_CREATE":
                        case "UPLOAD_JOB":
                        case "UPLOAD_RESOLVE":
                        case "UPLOAD":
                            badgeColor = 0xFF2196F3; // blue for upload types
                            signatureTypeLabel = "Document Upload";
                            break;
                        default:
                            signatureTypeLabel = signatureType;
                    }
                }
                sigData.put("signatureType", signatureType);
                sigData.put("signatureTypeLabel", signatureTypeLabel);
                sigData.put("badgeColor", badgeColor);

                // Include signer info for UI
                String signerRole = null;
                if (sig.getUser() != null) {
                    Map<String, Object> userData = new java.util.HashMap<>();
                    userData.put("id", sig.getUser().getId());
                    userData.put("accountId", sig.getUser().getAccountId());
                    userData.put("fullName", sig.getUser().getFullName());
                    userData.put("email", sig.getUser().getEmail());
                    userData.put("department", sig.getUser().getDepartment());
                    userData.put("position", sig.getUser().getPosition());

                    // Extract the primary role for display
                    if (sig.getUser().getRoles() != null && !sig.getUser().getRoles().isEmpty()) {
                        String firstRole = sig.getUser().getRoles().iterator().next();
                        // Normalize role name for display
                        if ("ADMIN".equalsIgnoreCase(firstRole)) {
                            signerRole = "SYSTEM ADMIN";
                        } else if ("REVIEWER".equalsIgnoreCase(firstRole)) {
                            signerRole = "REVIEWER";
                        } else if ("MANAGER".equalsIgnoreCase(firstRole)) {
                            signerRole = "MANAGER";
                        } else {
                            signerRole = firstRole;
                        }
                        userData.put("roles", sig.getUser().getRoles());
                    }
                    sigData.put("user", userData);
                }

                // Enhance signature type label based on signer role (for better UX display)
                // Example: "Document Upload" becomes "Document Upload (REVIEWER)"
                if (signatureType.equals("UPLOAD") || signatureType.startsWith("UPLOAD_")) {
                    if (signerRole != null) {
                        signatureTypeLabel = "Document Upload (" + signerRole + ")";
                    }
                }
                
                // Include document uploader info (only for the first signature to show who uploaded)
                if (i == 0) {
                    try {
                        Document docEntity = documentRepository.findById(docId).orElse(null);
                        if (docEntity != null && docEntity.getOwner() != null) {
                            Map<String, Object> uploaderData = new java.util.HashMap<>();
                            uploaderData.put("id", docEntity.getOwner().getId());
                            uploaderData.put("accountId", docEntity.getOwner().getAccountId());
                            uploaderData.put("fullName", docEntity.getOwner().getFullName());
                            uploaderData.put("department", docEntity.getOwner().getDepartment());
                            sigData.put("uploader", uploaderData);
                        }
                    } catch (Exception e) {
                        log.debug("Could not fetch uploader info for signature chain", e);
                    }
                }
                chainData.add(sigData);
            }

            return ResponseEntity.ok(ApiResponse.success("Signature chain retrieved", chainData));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("Error retrieving signature chain", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to retrieve signature chain"));
        }
    }

    /**
     * Verify signature authenticity
     * POST /api/sign/verify
     */
    @PostMapping("/verify")
    public ResponseEntity<ApiResponse<Map<String, Object>>> verifySignature(
            @RequestBody Map<String, Object> request) {
        try {
            Long signatureId = Long.valueOf(request.get("signatureId").toString());
            boolean isValid = signatureService.verifySignature(signatureId);

            Map<String, Object> responseData = Map.of(
                "valid", isValid,
                "signatureId", signatureId
            );

            return ResponseEntity.ok(ApiResponse.success(
                isValid ? "Signature is valid" : "Signature verification failed",
                responseData));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("Error verifying signature", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Failed to verify signature: " + e.getMessage()));
        }
    }

    /**
     * Signature revocation is permanently disabled to preserve immutable traceability.
     */
    @PostMapping("/{signatureId}/revoke")
    public ResponseEntity<ApiResponse<Void>> revokeSignature(@PathVariable Long signatureId) {
        log.warn("Blocked signature revoke attempt for signatureId={}", signatureId);
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(ApiResponse.error("Signature revocation is disabled to preserve traceability"));
    }
}

