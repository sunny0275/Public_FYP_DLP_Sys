package com.dlp.platform.util;

import org.bouncycastle.asn1.ASN1InputStream;
import org.bouncycastle.asn1.ASN1OctetString;
import org.bouncycastle.asn1.ASN1Primitive;
import org.bouncycastle.asn1.x509.*;

import java.io.ByteArrayInputStream;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.*;

public final class X509Utils {
    private X509Utils() {}

    public static X509Certificate parsePemCertificate(String pem) throws Exception {
        CertificateFactory cf = CertificateFactory.getInstance("X.509");
        return (X509Certificate) cf.generateCertificate(new ByteArrayInputStream(pem.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    }

    public static Map<String, Object> toEnterpriseSummary(X509Certificate cert) throws Exception {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("subject", cert.getSubjectX500Principal().getName());
        out.put("issuer", cert.getIssuerX500Principal().getName());
        out.put("serialHex", cert.getSerialNumber().toString(16));
        out.put("notBefore", cert.getNotBefore().toInstant().toString());
        out.put("notAfter", cert.getNotAfter().toInstant().toString());
        out.put("keyUsage", keyUsageNames(cert.getKeyUsage()));
        out.put("extendedKeyUsage", safeList(cert.getExtendedKeyUsage()));
        out.put("ocspUrls", getOcspUrls(cert));
        out.put("crlDistributionPoints", getCrlDistributionPoints(cert));
        return out;
    }

    private static List<String> keyUsageNames(boolean[] ku) {
        if (ku == null) return List.of();
        String[] names = new String[] {
            "digitalSignature",
            "nonRepudiation",
            "keyEncipherment",
            "dataEncipherment",
            "keyAgreement",
            "keyCertSign",
            "cRLSign",
            "encipherOnly",
            "decipherOnly"
        };
        List<String> out = new ArrayList<>();
        for (int i = 0; i < ku.length && i < names.length; i++) {
            if (ku[i]) out.add(names[i]);
        }
        return out;
    }

    private static List<String> safeList(List<String> v) {
        return v == null ? List.of() : v;
    }

    private static List<String> getOcspUrls(X509Certificate cert) throws Exception {
        byte[] extVal = cert.getExtensionValue(Extension.authorityInfoAccess.getId());
        if (extVal == null) return List.of();
        AuthorityInformationAccess aia = AuthorityInformationAccess.getInstance(readExtensionValue(extVal));
        List<String> urls = new ArrayList<>();
        for (AccessDescription ad : aia.getAccessDescriptions()) {
            if (AccessDescription.id_ad_ocsp.equals(ad.getAccessMethod())) {
                GeneralName name = ad.getAccessLocation();
                if (name.getTagNo() == GeneralName.uniformResourceIdentifier) {
                    urls.add(name.getName().toString());
                }
            }
        }
        return urls;
    }

    private static List<String> getCrlDistributionPoints(X509Certificate cert) throws Exception {
        byte[] extVal = cert.getExtensionValue(Extension.cRLDistributionPoints.getId());
        if (extVal == null) return List.of();
        CRLDistPoint distPoint = CRLDistPoint.getInstance(readExtensionValue(extVal));
        List<String> urls = new ArrayList<>();
        for (DistributionPoint dp : distPoint.getDistributionPoints()) {
            DistributionPointName dpn = dp.getDistributionPoint();
            if (dpn == null) continue;
            if (dpn.getType() == DistributionPointName.FULL_NAME) {
                GeneralNames gns = GeneralNames.getInstance(dpn.getName());
                for (GeneralName gn : gns.getNames()) {
                    if (gn.getTagNo() == GeneralName.uniformResourceIdentifier) {
                        urls.add(gn.getName().toString());
                    }
                }
            }
        }
        return urls;
    }

    private static ASN1Primitive readExtensionValue(byte[] extVal) throws Exception {
        try (ASN1InputStream ais1 = new ASN1InputStream(extVal)) {
            ASN1OctetString oct = (ASN1OctetString) ais1.readObject();
            try (ASN1InputStream ais2 = new ASN1InputStream(oct.getOctets())) {
                return ais2.readObject();
            }
        }
    }
}


