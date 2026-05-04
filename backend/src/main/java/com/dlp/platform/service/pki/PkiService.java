package com.dlp.platform.service.pki;

import com.dlp.platform.entity.User;
import com.dlp.platform.entity.UserCertificate;
import com.dlp.platform.repository.UserCertificateRepository;
import com.dlp.platform.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bouncycastle.asn1.ocsp.OCSPObjectIdentifiers;
import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.asn1.x509.*;
import org.bouncycastle.cert.X509CertificateHolder;
import org.bouncycastle.cert.X509v2CRLBuilder;
import org.bouncycastle.cert.X509v3CertificateBuilder;
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter;
import org.bouncycastle.cert.jcajce.JcaX509ExtensionUtils;
import org.bouncycastle.cert.jcajce.JcaX509v3CertificateBuilder;
import org.bouncycastle.cert.ocsp.*;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.openssl.PEMParser;
import org.bouncycastle.openssl.jcajce.JcaPEMWriter;
import org.bouncycastle.operator.ContentSigner;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.*;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.*;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;

@Service
@Slf4j
@RequiredArgsConstructor
public class PkiService {

    private final UserCertificateRepository userCertificateRepository;
    private final UserRepository userRepository;

    @Value("${dlp.pki.enabled:true}")
    private boolean pkiEnabled;

    @Value("${dlp.pki.ca.subject:CN=DLP Root CA,O=DLP Platform,C=HK}")
    private String caSubject;

    @Value("${dlp.pki.ca.key-path:/app/pki/ca.key.pem}")
    private String caKeyPath;

    @Value("${dlp.pki.ca.cert-path:/app/pki/ca.crt.pem}")
    private String caCertPath;

    @Value("${dlp.pki.ca.valid-days:3650}")
    private int caValidDays;

    @Value("${dlp.pki.leaf.valid-days:365}")
    private int leafValidDays;

    @Value("${dlp.pki.ocsp.responder-url:http://localhost:18080/api/pki/ocsp}")
    private String ocspResponderUrl;

    static {
        Security.addProvider(new BouncyCastleProvider());
    }

    private volatile PrivateKey caPrivateKey;
    private volatile X509Certificate caCertificate;

    @PostConstruct
    public void init() {
        if (!pkiEnabled) {
            log.warn("PKI is disabled (dlp.pki.enabled=false)");
            return;
        }
        try {
            loadOrCreateCa();
        } catch (Exception e) {
            log.error("Failed to initialize PKI CA", e);
            throw new RuntimeException("PKI initialization failed", e);
        }
    }

    public boolean isEnabled() {
        return pkiEnabled;
    }

    public X509Certificate getCaCertificate() {
        ensureEnabled();
        return caCertificate;
    }

    public String getCaCertificatePem() throws IOException {
        ensureEnabled();
        return toPem(caCertificate);
    }

    public UserCertificate issueOrReuseUserCertificate(Long userId, PublicKey publicKey) throws Exception {
        ensureEnabled();
        if (userId == null) throw new IllegalArgumentException("userId is required");
        if (publicKey == null) throw new IllegalArgumentException("publicKey is required");

        User user = userRepository.findById(userId).orElseThrow(() -> new EntityNotFoundException("User not found"));

        String pubFp = sha256Hex(publicKey.getEncoded());
        Optional<UserCertificate> existingActive = userCertificateRepository.findTopByUserIdAndStatusOrderByNotAfterDesc(
            userId, UserCertificate.Status.ACTIVE
        );
        if (existingActive.isPresent() && Objects.equals(existingActive.get().getPublicKeyFingerprint(), pubFp)) {
            if (existingActive.get().getNotAfter().isAfter(LocalDateTime.now())) {
                return existingActive.get();
            }
        }

        X500Name issuer = new X500Name(caSubject);
        X500Name subject = new X500Name(String.format(
            "CN=%s,OU=%s,O=DLP Platform,C=HK",
            sanitizeDnValue(user.getFullName() != null ? user.getFullName() : user.getAccountId()),
            sanitizeDnValue(user.getDepartment() != null ? user.getDepartment() : "Unknown")
        ));

        BigInteger serial = new BigInteger(160, new SecureRandom()).abs();
        Date notBefore = new Date(System.currentTimeMillis() - 60_000L);
        Date notAfter = Date.from(LocalDateTime.now().plusDays(leafValidDays).atZone(ZoneId.systemDefault()).toInstant());

        JcaX509ExtensionUtils extUtils = new JcaX509ExtensionUtils();
        SubjectPublicKeyInfo spki = SubjectPublicKeyInfo.getInstance(publicKey.getEncoded());

        X509v3CertificateBuilder builder = new JcaX509v3CertificateBuilder(
            issuer, serial, notBefore, notAfter, subject, publicKey
        );

        builder.addExtension(Extension.basicConstraints, true, new BasicConstraints(false));
        builder.addExtension(Extension.keyUsage, true, new KeyUsage(KeyUsage.digitalSignature | KeyUsage.nonRepudiation));
        builder.addExtension(Extension.extendedKeyUsage, false, new ExtendedKeyUsage(KeyPurposeId.id_kp_codeSigning));
        builder.addExtension(Extension.subjectKeyIdentifier, false, extUtils.createSubjectKeyIdentifier(spki));
        builder.addExtension(Extension.authorityKeyIdentifier, false, extUtils.createAuthorityKeyIdentifier(caCertificate));
        builder.addExtension(Extension.authorityInfoAccess, false, buildAia(ocspResponderUrl));
        builder.addExtension(Extension.cRLDistributionPoints, false, buildCrlDp());

        ContentSigner signer = new JcaContentSignerBuilder("SHA256withECDSA").setProvider("BC").build(caPrivateKey);
        X509CertificateHolder holder = builder.build(signer);
        X509Certificate leafCert = new JcaX509CertificateConverter().setProvider("BC").getCertificate(holder);
        leafCert.verify(caCertificate.getPublicKey(), "BC");

        UserCertificate record = UserCertificate.builder()
            .userId(userId)
            .serialHex(holder.getSerialNumber().toString(16))
            .certificatePem(toPem(leafCert))
            .publicKeyFingerprint(pubFp)
            .notBefore(toLdt(notBefore))
            .notAfter(toLdt(notAfter))
            .status(UserCertificate.Status.ACTIVE)
            .build();

        return userCertificateRepository.save(record);
    }

    public void revokeCertificate(String serialHex, String reason) {
        ensureEnabled();
        UserCertificate cert = userCertificateRepository.findBySerialHex(normalizeHex(serialHex))
            .orElseThrow(() -> new EntityNotFoundException("Certificate not found"));
        if (cert.getStatus() == UserCertificate.Status.REVOKED) return;
        cert.setStatus(UserCertificate.Status.REVOKED);
        cert.setRevokedAt(LocalDateTime.now());
        cert.setRevocationReason(reason);
        userCertificateRepository.save(cert);
    }

    public boolean isRevoked(String serialHex) {
        if (!pkiEnabled) return false;
        Optional<UserCertificate> cert = userCertificateRepository.findBySerialHex(normalizeHex(serialHex));
        return cert.isPresent() && cert.get().getStatus() == UserCertificate.Status.REVOKED;
    }

    public byte[] generateCrlDer() throws Exception {
        ensureEnabled();
        X500Name issuer = new X500Name(caSubject);
        Date now = new Date();
        Date nextUpdate = new Date(System.currentTimeMillis() + 24L * 60 * 60 * 1000);
        X509v2CRLBuilder crlBuilder = new X509v2CRLBuilder(issuer, now);
        crlBuilder.setNextUpdate(nextUpdate);
        for (UserCertificate revoked : userCertificateRepository.findByStatus(UserCertificate.Status.REVOKED)) {
            BigInteger serial = new BigInteger(revoked.getSerialHex(), 16);
            Date revokedAt = Date.from(revoked.getRevokedAt().atZone(ZoneId.systemDefault()).toInstant());
            crlBuilder.addCRLEntry(serial, revokedAt, CRLReason.privilegeWithdrawn);
        }
        ContentSigner signer = new JcaContentSignerBuilder("SHA256withECDSA").setProvider("BC").build(caPrivateKey);
        return crlBuilder.build(signer).getEncoded();
    }

    public byte[] handleOcspRequest(byte[] ocspReqBytes) throws Exception {
        ensureEnabled();
        OCSPReq ocspReq = new OCSPReq(ocspReqBytes);
        BasicOCSPRespBuilder respBuilder = new BasicOCSPRespBuilder(
            new RespID(new X500Name(caCertificate.getSubjectX500Principal().getName()))
        );
        Date now = new Date();
        for (Req req : ocspReq.getRequestList()) {
            CertificateID certId = req.getCertID();
            BigInteger serial = certId.getSerialNumber();
            String serialHex = serial.toString(16);
            if (isRevoked(serialHex)) {
                UserCertificate revoked = userCertificateRepository.findBySerialHex(normalizeHex(serialHex)).orElse(null);
                Date revokedAt = revoked != null && revoked.getRevokedAt() != null
                    ? Date.from(revoked.getRevokedAt().atZone(ZoneId.systemDefault()).toInstant())
                    : now;
                respBuilder.addResponse(certId, new RevokedStatus(revokedAt, CRLReason.privilegeWithdrawn));
            } else {
                boolean known = userCertificateRepository.findBySerialHex(normalizeHex(serialHex)).isPresent();
                respBuilder.addResponse(certId, known ? CertificateStatus.GOOD : new UnknownStatus());
            }
        }
        Extension nonceExt = ocspReq.getExtension(OCSPObjectIdentifiers.id_pkix_ocsp_nonce);
        if (nonceExt != null) {
            respBuilder.setResponseExtensions(new Extensions(new Extension[] {
                new Extension(OCSPObjectIdentifiers.id_pkix_ocsp_nonce, false, nonceExt.getExtnValue())
            }));
        }
        ContentSigner signer = new JcaContentSignerBuilder("SHA256withECDSA").setProvider("BC").build(caPrivateKey);
        BasicOCSPResp basic = respBuilder.build(signer, null, now);
        return new OCSPRespBuilder().build(OCSPRespBuilder.SUCCESSFUL, basic).getEncoded();
    }

    public PkiVerifyResult verifyCertificateChainAndStatus(X509Certificate leafCert) throws Exception {
        ensureEnabled();
        try {
            leafCert.checkValidity();
        } catch (Exception e) {
            return PkiVerifyResult.invalid("Certificate not valid at current time: " + e.getMessage());
        }
        try {
            leafCert.verify(caCertificate.getPublicKey(), "BC");
        } catch (Exception e) {
            return PkiVerifyResult.invalid("Certificate chain verification failed: " + e.getMessage());
        }
        String serialHex = leafCert.getSerialNumber().toString(16);
        if (isRevoked(serialHex)) return PkiVerifyResult.revoked("Certificate revoked");
        boolean known = userCertificateRepository.findBySerialHex(normalizeHex(serialHex)).isPresent();
        if (!known) return PkiVerifyResult.unknown("Certificate serial not found in PKI database");
        return PkiVerifyResult.good();
    }

    private void ensureEnabled() {
        if (!pkiEnabled) throw new IllegalStateException("PKI is disabled");
        if (caPrivateKey == null || caCertificate == null) throw new IllegalStateException("PKI CA not initialized");
    }

    private void loadOrCreateCa() throws Exception {
        Path keyP = Path.of(caKeyPath);
        Path certP = Path.of(caCertPath);
        Files.createDirectories(keyP.getParent());
        Files.createDirectories(certP.getParent());
        if (Files.exists(keyP) && Files.exists(certP)) {
            this.caPrivateKey = readPrivateKeyPem(keyP);
            this.caCertificate = readCertificatePem(certP);
            log.info("Loaded existing CA from {} and {}", caKeyPath, caCertPath);
            return;
        }
        KeyPair caKp = generateSecp256k1KeyPair();
        X509Certificate caCert = generateRootCa(caKp);
        writePrivateKeyPem(keyP, caKp.getPrivate());
        writeCertificatePem(certP, caCert);
        this.caPrivateKey = caKp.getPrivate();
        this.caCertificate = caCert;
        log.warn("Generated NEW Root CA at {} and {} (development use).", caKeyPath, caCertPath);
    }

    private KeyPair generateSecp256k1KeyPair() throws Exception {
        KeyPairGenerator keyGen = KeyPairGenerator.getInstance("EC", "BC");
        keyGen.initialize(new java.security.spec.ECGenParameterSpec("secp256k1"), new SecureRandom());
        return keyGen.generateKeyPair();
    }

    private X509Certificate generateRootCa(KeyPair caKeyPair) throws Exception {
        X500Name issuer = new X500Name(caSubject);
        BigInteger serial = new BigInteger(160, new SecureRandom()).abs();
        Date notBefore = new Date(System.currentTimeMillis() - 60_000L);
        Date notAfter = Date.from(LocalDateTime.now().plusDays(caValidDays).atZone(ZoneId.systemDefault()).toInstant());
        X509v3CertificateBuilder builder = new JcaX509v3CertificateBuilder(
            issuer, serial, notBefore, notAfter, issuer, caKeyPair.getPublic()
        );
        JcaX509ExtensionUtils extUtils = new JcaX509ExtensionUtils();
        SubjectPublicKeyInfo spki = SubjectPublicKeyInfo.getInstance(caKeyPair.getPublic().getEncoded());
        builder.addExtension(Extension.basicConstraints, true, new BasicConstraints(true));
        builder.addExtension(Extension.keyUsage, true, new KeyUsage(KeyUsage.keyCertSign | KeyUsage.cRLSign));
        builder.addExtension(Extension.subjectKeyIdentifier, false, extUtils.createSubjectKeyIdentifier(spki));
        ContentSigner signer = new JcaContentSignerBuilder("SHA256withECDSA").setProvider("BC").build(caKeyPair.getPrivate());
        X509CertificateHolder holder = builder.build(signer);
        X509Certificate cert = new JcaX509CertificateConverter().setProvider("BC").getCertificate(holder);
        cert.verify(caKeyPair.getPublic());
        return cert;
    }

    private AuthorityInformationAccess buildAia(String ocspUrl) {
        if (!StringUtils.hasText(ocspUrl)) return new AuthorityInformationAccess(new AccessDescription[] {});
        GeneralName ocspName = new GeneralName(GeneralName.uniformResourceIdentifier, ocspUrl);
        return new AuthorityInformationAccess(new AccessDescription(AccessDescription.id_ad_ocsp, ocspName));
    }

    private CRLDistPoint buildCrlDp() throws IOException {
        String crlUrl = "http://localhost:18080/api/pki/crl";
        DistributionPointName dpn = new DistributionPointName(new GeneralNames(new GeneralName(GeneralName.uniformResourceIdentifier, crlUrl)));
        return new CRLDistPoint(new DistributionPoint[] { new DistributionPoint(dpn, null, null) });
    }

    private static String sha256Hex(byte[] bytes) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(bytes);
        StringBuilder sb = new StringBuilder();
        for (byte b : hash) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    private static String toPem(Object obj) throws IOException {
        StringWriter sw = new StringWriter();
        try (JcaPEMWriter w = new JcaPEMWriter(sw)) { w.writeObject(obj); }
        return sw.toString();
    }

    private static void writePrivateKeyPem(Path path, PrivateKey key) throws IOException {
        Files.writeString(path, toPem(key), StandardCharsets.UTF_8);
    }

    private static void writeCertificatePem(Path path, X509Certificate cert) throws IOException {
        Files.writeString(path, toPem(cert), StandardCharsets.UTF_8);
    }

    private static PrivateKey readPrivateKeyPem(Path path) throws Exception {
        try (Reader r = Files.newBufferedReader(path, StandardCharsets.UTF_8); PEMParser parser = new PEMParser(r)) {
            Object obj = parser.readObject();
            if (obj instanceof org.bouncycastle.openssl.PEMKeyPair kp) {
                return new org.bouncycastle.openssl.jcajce.JcaPEMKeyConverter().setProvider("BC").getKeyPair(kp).getPrivate();
            }
            if (obj instanceof org.bouncycastle.asn1.pkcs.PrivateKeyInfo pki) {
                return new org.bouncycastle.openssl.jcajce.JcaPEMKeyConverter().setProvider("BC").getPrivateKey(pki);
            }
            throw new IllegalArgumentException("Unsupported key format in " + path);
        }
    }

    private static X509Certificate readCertificatePem(Path path) throws IOException, CertificateException {
        try (InputStream in = Files.newInputStream(path)) {
            return (X509Certificate) java.security.cert.CertificateFactory.getInstance("X.509").generateCertificate(in);
        }
    }

    private static LocalDateTime toLdt(Date date) {
        return LocalDateTime.ofInstant(date.toInstant(), ZoneId.systemDefault());
    }

    private static String normalizeHex(String hex) {
        if (hex == null) return null;
        String h = hex.trim().toLowerCase();
        if (h.startsWith("0x")) h = h.substring(2);
        return h;
    }

    private static String sanitizeDnValue(String value) {
        if (value == null) return "Unknown";
        return value.replace(",", " ").replace("\n", " ").replace("\r", " ").trim();
    }

    public static class PkiVerifyResult {
        public enum Status { GOOD, REVOKED, UNKNOWN, INVALID }
        private final Status status;
        private final String message;
        public PkiVerifyResult(Status status, String message) { this.status = status; this.message = message; }
        public Status getStatus() { return status; }
        public String getMessage() { return message; }
        public static PkiVerifyResult good() { return new PkiVerifyResult(Status.GOOD, "OK"); }
        public static PkiVerifyResult revoked(String msg) { return new PkiVerifyResult(Status.REVOKED, msg); }
        public static PkiVerifyResult unknown(String msg) { return new PkiVerifyResult(Status.UNKNOWN, msg); }
        public static PkiVerifyResult invalid(String msg) { return new PkiVerifyResult(Status.INVALID, msg); }
    }
}
