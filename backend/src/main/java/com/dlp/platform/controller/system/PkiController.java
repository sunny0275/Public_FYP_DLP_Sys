package com.dlp.platform.controller.system;

import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.service.pki.PkiService;
import com.dlp.platform.service.pki.PkiMaintenanceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * PKI endpoints for document signature certificate chain:
 * - CA certificate
 * - CRL distribution
 * - OCSP responder
 * - Admin issuance / revocation helpers
 */
@RestController
@RequestMapping("/pki")
@RequiredArgsConstructor
@Slf4j
public class PkiController {

    private final PkiService pkiService;
    private final PkiMaintenanceService pkiMaintenanceService;

    @GetMapping(value = "/ca.crt", produces = "application/x-pem-file")
    public ResponseEntity<String> getCaCertificatePem() throws Exception {
        return ResponseEntity.ok(pkiService.getCaCertificatePem());
    }

    @GetMapping(value = "/crl", produces = "application/pkix-crl")
    public ResponseEntity<byte[]> getCrl() throws Exception {
        byte[] der = pkiService.generateCrlDer();
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"dlp.crl\"")
            .contentType(MediaType.parseMediaType("application/pkix-crl"))
            .body(der);
    }

    @PostMapping(value = "/ocsp", consumes = "application/ocsp-request", produces = "application/ocsp-response")
    public ResponseEntity<byte[]> ocsp(@RequestBody byte[] body) throws Exception {
        byte[] resp = pkiService.handleOcspRequest(body);
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType("application/ocsp-response"))
            .body(resp);
    }

    // Admin helpers
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/certificates/{serialHex}/revoke")
    public ResponseEntity<ApiResponse<Void>> revoke(@PathVariable String serialHex, @RequestBody Map<String, Object> req) {
        String reason = req.getOrDefault("reason", "revoked").toString();
        pkiService.revokeCertificate(serialHex, reason);
        return ResponseEntity.ok(ApiResponse.success("Certificate revoked", null));
    }

    /**
     * Backfill PKI certificate chains for legacy signature records.
     * This will ONLY update existing signatures that are missing certificatePem/issuer/serial.
     */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/backfill/signatures")
    public ResponseEntity<ApiResponse<Map<String, Object>>> backfillSignatureChains() throws Exception {
        var result = pkiMaintenanceService.backfillSignatureCertificateChains();
        Map<String, Object> data = Map.of(
            "scanned", result.scanned(),
            "updated", result.updated(),
            "skipped", result.skipped(),
            "failed", result.failed()
        );
        return ResponseEntity.ok(ApiResponse.success("Backfill completed", data));
    }
}


