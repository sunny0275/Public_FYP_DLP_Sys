package com.dlp.platform.service.signature;

import com.dlp.platform.entity.User;
import com.dlp.platform.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.SecureRandom;
import java.security.Security;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.LocalDateTime;

/**
 * Manages per-user signing keys for non-interactive signing (auto-sign).
 *
 * If a user has no signing key yet, it is generated and stored encrypted at rest.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class UserSigningKeyService {

    static {
        Security.addProvider(new BouncyCastleProvider());
    }

    private final UserRepository userRepository;
    private final SigningKeyCryptoService cryptoService;

    @Transactional
    public PrivateKey getOrCreatePrivateKey(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalStateException("User not found"));
        return getOrCreatePrivateKey(user);
    }

    @Transactional
    public PrivateKey getOrCreatePrivateKey(User user) {
        if (user.getSigningPrivateKeyEnc() == null || user.getSigningPrivateKeyEnc().isBlank()) {
            KeyPair kp = generateSecp256k1KeyPair();
            String enc = cryptoService.encrypt(kp.getPrivate().getEncoded());
            user.setSigningPrivateKeyEnc(enc);
            user.setSigningPublicKeyHex(bytesToHex(kp.getPublic().getEncoded()));
            user.setSigningKeyCreatedAt(LocalDateTime.now());
            userRepository.save(user);
            log.info("Generated new per-user signing key for user {}", user.getId());
            return kp.getPrivate();
        }

        byte[] pkcs8 = cryptoService.decrypt(user.getSigningPrivateKeyEnc());
        if (pkcs8 == null || pkcs8.length == 0) {
            throw new IllegalStateException("Signing key decrypt returned empty data");
        }
        try {
            KeyFactory kf = KeyFactory.getInstance("EC", "BC");
            return kf.generatePrivate(new PKCS8EncodedKeySpec(pkcs8));
        } catch (Exception e) {
            log.error("Failed to load signing private key for user {}", user.getId(), e);
            throw new RuntimeException("Failed to load signing private key", e);
        }
    }

    /**
     * Force-rotate the per-user signing key immediately.
     * This overwrites the stored key material (existing signatures remain verifiable because
     * the signature record stores the public key / certificate chain used at signing time).
     */
    @Transactional
    public PrivateKey rotateSigningKey(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalStateException("User not found"));
        return rotateSigningKey(user);
    }

    @Transactional
    public PrivateKey rotateSigningKey(User user) {
        KeyPair kp = generateSecp256k1KeyPair();
        String enc = cryptoService.encrypt(kp.getPrivate().getEncoded());
        user.setSigningPrivateKeyEnc(enc);
        user.setSigningPublicKeyHex(bytesToHex(kp.getPublic().getEncoded()));
        user.setSigningKeyCreatedAt(LocalDateTime.now());
        userRepository.save(user);
        log.info("Rotated per-user signing key for user {}", user.getId());
        return kp.getPrivate();
    }

    private static KeyPair generateSecp256k1KeyPair() {
        try {
            KeyPairGenerator keyGen = KeyPairGenerator.getInstance("EC", "BC");
            keyGen.initialize(new ECGenParameterSpec("secp256k1"), new SecureRandom());
            return keyGen.generateKeyPair();
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate secp256k1 key pair", e);
        }
    }

    public static String bytesToHex(byte[] bytes) {
        StringBuilder result = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            result.append(String.format("%02x", b));
        }
        return result.toString();
    }
}


