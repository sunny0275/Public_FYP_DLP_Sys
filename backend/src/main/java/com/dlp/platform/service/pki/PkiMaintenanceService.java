package com.dlp.platform.service.pki;

import com.dlp.platform.entity.SignatureRecord;
import com.dlp.platform.repository.SignatureRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.PublicKey;
import java.util.List;

@Service
@Slf4j
@RequiredArgsConstructor
public class PkiMaintenanceService {

    private final SignatureRepository signatureRepository;
    private final PkiService pkiService;

    @Transactional
    public BackfillResult backfillSignatureCertificateChains() throws Exception {
        if (pkiService == null || !pkiService.isEnabled()) {
            throw new IllegalStateException("PKI is disabled; cannot backfill certificate chains");
        }
        List<SignatureRecord> all = signatureRepository.findAll();
        int scanned = 0, updated = 0, skipped = 0, failed = 0;
        for (SignatureRecord sig : all) {
            scanned++;
            try {
                boolean missing = (sig.getCertificatePem() == null || sig.getCertificatePem().isBlank()) ||
                    (sig.getIssuerCertificatePem() == null || sig.getIssuerCertificatePem().isBlank()) ||
                    (sig.getCertificateSerialHex() == null || sig.getCertificateSerialHex().isBlank());
                if (!missing) { skipped++; continue; }
                if (sig.getPublicKeyHex() == null || sig.getPublicKeyHex().isBlank()) { failed++; continue; }
                PublicKey pub = pkiServicePublicKeyFromHex(sig.getPublicKeyHex());
                var userCert = pkiService.issueOrReuseUserCertificate(sig.getUserId(), pub);
                sig.setCertificatePem(userCert.getCertificatePem());
                sig.setIssuerCertificatePem(pkiService.getCaCertificatePem());
                sig.setCertificateSerialHex(userCert.getSerialHex());
                signatureRepository.save(sig);
                updated++;
            } catch (Exception e) {
                failed++;
                log.warn("Backfill failed for signatureId={}: {}", sig.getId(), e.getMessage());
            }
        }
        return new BackfillResult(scanned, updated, skipped, failed);
    }

    private PublicKey pkiServicePublicKeyFromHex(String publicKeyHex) throws Exception {
        byte[] bytes = hexToBytes(publicKeyHex);
        java.security.spec.X509EncodedKeySpec spec = new java.security.spec.X509EncodedKeySpec(bytes);
        if (java.security.Security.getProvider("BC") == null) java.security.Security.addProvider(new BouncyCastleProvider());
        return java.security.KeyFactory.getInstance("EC", "BC").generatePublic(spec);
    }

    private byte[] hexToBytes(String hex) {
        String h = hex.trim();
        if (h.startsWith("0x") || h.startsWith("0X")) h = h.substring(2);
        int len = h.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2)
            data[i / 2] = (byte) ((Character.digit(h.charAt(i), 16) << 4) + Character.digit(h.charAt(i + 1), 16));
        return data;
    }

    public record BackfillResult(int scanned, int updated, int skipped, int failed) {}
}
