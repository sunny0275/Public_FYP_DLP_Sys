package com.dlp.platform.util;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.security.SignatureException;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

@Slf4j
@Component
public class JwtUtil {

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${jwt.access-token-expiration}")
    private long accessTokenExpiration;

    @Value("${jwt.refresh-token-expiration}")
    private long refreshTokenExpiration;

    /**
     * Validate JWT secret on application startup
     */
    @PostConstruct
    public void validateJwtSecret() {
        if (jwtSecret == null || jwtSecret.trim().isEmpty()) {
            throw new IllegalStateException("JWT_SECRET environment variable must be set");
        }

        if (jwtSecret.length() < 64) {
            throw new IllegalStateException("JWT_SECRET must be at least 64 characters long for cryptographic security");
        }

        String lowerSecret = jwtSecret.toLowerCase();

        // Check for known default/weak values and patterns
        String[] weakPatterns = {
            "your-secret", "change-me", "default", "password",
            "test", "demo", "example", "jwt-secret", "secret", "mysecret"
        };

        for (String pattern : weakPatterns) {
            if (lowerSecret.contains(pattern)) {
                throw new IllegalStateException(
                    "JWT_SECRET contains weak pattern '" + pattern + "'. Use a cryptographically secure random string."
                );
            }
        }

        // Check for keyboard patterns
        String[] keyboardPatterns = {
            "qwerty", "asdfgh", "zxcvbn", "qwertz", "azerty",
            "qwert", "asdf", "zxcv", "yuiop", "hjkl", "bnm"
        };

        for (String pattern : keyboardPatterns) {
            if (lowerSecret.contains(pattern)) {
                throw new IllegalStateException(
                    "JWT_SECRET contains keyboard pattern '" + pattern + "'. Use a random string."
                );
            }
        }

        // Check for repeated characters (e.g., "aaaaaaa...")
        if (jwtSecret.matches("(.)\\1{10,}")) {
            throw new IllegalStateException("JWT_SECRET contains too many repeated characters. Use a random string.");
        }

        // Check for ascending sequential patterns (numeric and alphanumeric)
        if (lowerSecret.matches(".*(?:01234|12345|23456|34567|45678|56789|6789a|789ab|89abc|9abcd|abcde|bcdef|cdefg).*")) {
            throw new IllegalStateException("JWT_SECRET contains ascending sequential patterns. Use a random string.");
        }

        // Check for descending sequential patterns
        if (lowerSecret.matches(".*(?:98765|87654|76543|65432|54321|43210|fedcb|edcba|dcba9|cba98|ba987|a9876).*")) {
            throw new IllegalStateException("JWT_SECRET contains descending sequential patterns. Use a random string.");
        }

        // Calculate and check entropy (Shannon entropy)
        double entropy = calculateEntropy(jwtSecret);
        if (entropy < 4.0) {
            throw new IllegalStateException(
                String.format("JWT_SECRET has insufficient entropy (%.2f bits/char, minimum 4.0 required). Use a cryptographically random string.", entropy)
            );
        }

        log.info("JWT secret validated successfully (length: {} characters, entropy: {:.2f} bits/char)",
            jwtSecret.length(), entropy);
    }

    /**
     * Calculate Shannon entropy of a string
     * Returns bits of entropy per character
     * Higher values indicate more randomness
     */
    private double calculateEntropy(String text) {
        if (text == null || text.isEmpty()) {
            return 0.0;
        }

        java.util.Map<Character, Integer> frequencyMap = new java.util.HashMap<>();
        for (char c : text.toCharArray()) {
            frequencyMap.merge(c, 1, Integer::sum);
        }

        double entropy = 0.0;
        int length = text.length();

        for (int count : frequencyMap.values()) {
            double probability = (double) count / length;
            entropy -= probability * (Math.log(probability) / Math.log(2));
        }

        return entropy;
    }

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Generate access token with user details and token version
     */
    public String generateAccessToken(Long userId, String accountId, Set<String> roles, Integer tokenVersion) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", userId);
        claims.put("accountId", accountId);
        claims.put("roles", roles);
        claims.put("tokenVersion", tokenVersion);
        claims.put("type", "ACCESS");

        return Jwts.builder()
                .claims(claims)
                .subject(accountId)
                .issuedAt(Date.from(Instant.now()))
                .expiration(Date.from(Instant.now().plusMillis(accessTokenExpiration)))
                .signWith(getSigningKey())
                .compact();
    }

    /**
     * Generate refresh token
     */
    public String generateRefreshToken(Long userId, String accountId) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", userId);
        claims.put("accountId", accountId);
        claims.put("type", "REFRESH");

        return Jwts.builder()
                .claims(claims)
                .subject(accountId)
                .issuedAt(Date.from(Instant.now()))
                .expiration(Date.from(Instant.now().plusMillis(refreshTokenExpiration)))
                .signWith(getSigningKey())
                .compact();
    }

    /**
     * Extract account ID from token
     */
    public String extractAccountId(String token) {
        return extractClaims(token).getSubject();
    }

    /**
     * Extract user ID from token
     */
    public Long extractUserId(String token) {
        return extractClaims(token).get("userId", Long.class);
    }

    /**
     * Extract roles from token
     */
    @SuppressWarnings("unchecked")
    public Set<String> extractRoles(String token) {
        Object roles = extractClaims(token).get("roles");
        if (roles instanceof Set) {
            return (Set<String>) roles;
        }
        return Set.of();
    }

    /**
     * Extract token version from token
     */
    public Integer extractTokenVersion(String token) {
        return extractClaims(token).get("tokenVersion", Integer.class);
    }

    /**
     * Extract token type (ACCESS or REFRESH)
     */
    public String extractTokenType(String token) {
        return extractClaims(token).get("type", String.class);
    }

    /**
     * Extract all claims from token
     */
    public Claims extractClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    /**
     * Validate token
     */
    public boolean validateToken(String token) {
        try {
            Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token);
            return true;
        } catch (SignatureException e) {
            log.error("Invalid JWT signature: {}", e.getMessage());
        } catch (MalformedJwtException e) {
            log.error("Invalid JWT token: {}", e.getMessage());
        } catch (ExpiredJwtException e) {
            log.error("JWT token is expired: {}", e.getMessage());
        } catch (UnsupportedJwtException e) {
            log.error("JWT token is unsupported: {}", e.getMessage());
        } catch (IllegalArgumentException e) {
            log.error("JWT claims string is empty: {}", e.getMessage());
        }
        return false;
    }

    /**
     * Check if token is expired
     */
    public boolean isTokenExpired(String token) {
        try {
            Date expiration = extractClaims(token).getExpiration();
            return expiration.before(Date.from(Instant.now()));
        } catch (Exception e) {
            return true;
        }
    }

    /**
     * Validate access token specifically
     */
    public boolean validateAccessToken(String token) {
        if (!validateToken(token)) {
            return false;
        }
        String tokenType = extractTokenType(token);
        return "ACCESS".equals(tokenType);
    }

    /**
     * Validate refresh token specifically
     */
    public boolean validateRefreshToken(String token) {
        if (!validateToken(token)) {
            return false;
        }
        String tokenType = extractTokenType(token);
        return "REFRESH".equals(tokenType);
    }

    /**
     * Get token expiration time in milliseconds
     */
    public long getAccessTokenExpiration() {
        return accessTokenExpiration;
    }

    public long getRefreshTokenExpiration() {
        return refreshTokenExpiration;
    }
}
