package com.dlp.platform.service.document;

import com.dlp.platform.entity.User;
import com.dlp.platform.entity.WatermarkFingerprint;
import com.dlp.platform.repository.WatermarkFingerprintRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;

@Service
@Slf4j
@RequiredArgsConstructor
public class WatermarkFingerprintService {

    private static final int STRONG_MATCH_MAX_DISTANCE = 6;
    private static final int WEAK_MATCH_MAX_DISTANCE = 12;

    private final WatermarkFingerprintRepository watermarkFingerprintRepository;

    @Transactional
    public void recordFingerprint(String payloadHash, User user, String deviceId, Long documentId) {
        if (payloadHash == null || payloadHash.isBlank()) {
            log.warn("Skipping watermark fingerprint record: empty payload hash");
            return;
        }

        Long userId = user != null ? user.getId() : null;

        if (watermarkFingerprintRepository.findByPayloadHash(payloadHash).isPresent()) {
            log.debug("Watermark fingerprint already exists for payloadHash={}, skipping insert", payloadHash);
            return;
        }

        WatermarkFingerprint fingerprint = WatermarkFingerprint.builder()
            .payloadHash(payloadHash)
            .userId(userId)
            .deviceId(deviceId)
            .documentId(documentId)
            .build();

        watermarkFingerprintRepository.save(fingerprint);
        log.info("Recorded watermark fingerprint: payloadHash={}, userId={}, deviceId={}, documentId={}",
            payloadHash, userId, deviceId, documentId);
    }

    @Transactional
    public void recordDeepWatermarkFingerprint(String shortCode, String canonicalPayload, User user, String deviceId, Long documentId) {
        if (shortCode == null || shortCode.isBlank() || canonicalPayload == null || canonicalPayload.isBlank()) {
            log.warn("Skipping deep watermark fingerprint record: empty shortCode or canonical");
            return;
        }
        if (watermarkFingerprintRepository.findByShortCode(shortCode).isPresent()) {
            log.debug("Deep watermark fingerprint already exists for shortCode={}, skipping", shortCode);
            return;
        }
        if (watermarkFingerprintRepository.findByPayloadHash(canonicalPayload).isPresent()) {
            log.debug("Deep watermark fingerprint already exists for canonical payload, skipping");
            return;
        }
        Long userId = user != null ? user.getId() : null;
        WatermarkFingerprint fingerprint = WatermarkFingerprint.builder()
            .payloadHash(canonicalPayload)
            .shortCode(shortCode)
            .userId(userId)
            .deviceId(deviceId)
            .documentId(documentId)
            .build();
        watermarkFingerprintRepository.save(fingerprint);
        log.info("Recorded deep watermark fingerprint: shortCode={}, documentId={}", shortCode, documentId);
    }

    public void recordStegaStampFingerprint(String shortCode, String canonicalPayload, User user, String deviceId, Long documentId) {
        recordDeepWatermarkFingerprint(shortCode, canonicalPayload, user, deviceId, documentId);
    }

    @Transactional(readOnly = true)
    public Optional<WatermarkFingerprint> findByPayloadHash(String payloadHash) {
        if (payloadHash == null || payloadHash.isBlank()) {
            return Optional.empty();
        }
        return watermarkFingerprintRepository.findByPayloadHash(payloadHash);
    }

    @Transactional(readOnly = true)
    public Optional<WatermarkFingerprint> findByShortCode(String shortCode) {
        if (shortCode == null || shortCode.isBlank()) {
            return Optional.empty();
        }
        return watermarkFingerprintRepository.findByShortCode(shortCode);
    }

    @Transactional(readOnly = true)
    public Optional<FingerprintMatch> resolveByShortCode(String extractedShortCode) {
        if (extractedShortCode == null || extractedShortCode.isBlank()) {
            return Optional.empty();
        }
        String normalized = extractedShortCode.trim();
        return watermarkFingerprintRepository.findByShortCode(normalized)
            .map(fp -> new FingerprintMatch(fp, extractedShortCode, fp.getShortCode(), "EXACT", 0));
    }

    public record FingerprintMatch(
        WatermarkFingerprint fingerprint,
        String extractedPayload,
        String matchedPayload,
        String matchType,
        Integer distance
    ) {}

    @Transactional(readOnly = true)
    public Optional<FingerprintMatch> resolveBestMatch(String extractedPayload) {
        if (extractedPayload == null || extractedPayload.isBlank()) {
            return Optional.empty();
        }

        String normalized = normalizePayload(extractedPayload);
        if (normalized.isBlank()) {
            return Optional.empty();
        }

        List<String> candidates = buildCandidates(normalized);
        for (String candidate : candidates) {
            Optional<WatermarkFingerprint> exact = watermarkFingerprintRepository.findByPayloadHash(candidate);
            if (exact.isPresent()) {
                return Optional.of(new FingerprintMatch(
                    exact.get(),
                    extractedPayload,
                    candidate,
                    "EXACT",
                    0
                ));
            }
        }

        // Fuzzy fallback: tolerate small corruption after screenshot/crop/compression.
        List<WatermarkFingerprint> recent = watermarkFingerprintRepository.findTop500ByOrderByCreatedAtDesc();
        WatermarkFingerprint best = null;
        String bestCandidate = null;
        String bestStored = null;
        int bestDistance = Integer.MAX_VALUE;

        for (String candidate : candidates) {
            if (candidate.isBlank()) continue;
            for (WatermarkFingerprint fp : recent) {
                if (fp == null || fp.getPayloadHash() == null || fp.getPayloadHash().isBlank()) continue;
                String stored = fp.getPayloadHash();
                int d = levenshtein(candidate, stored);
                if (d < bestDistance) {
                    bestDistance = d;
                    best = fp;
                    bestCandidate = candidate;
                    bestStored = stored;
                }
            }
        }

        if (best == null) {
            return Optional.empty();
        }

        String matchedPayload = bestStored != null ? bestStored : bestCandidate;

        if (bestDistance <= STRONG_MATCH_MAX_DISTANCE) {
            log.info("Resolved watermark fingerprint with fuzzy match (distance={})", bestDistance);
            return Optional.of(new FingerprintMatch(
                best,
                extractedPayload,
                matchedPayload,
                "FUZZY",
                bestDistance
            ));
        }

        if (bestDistance <= WEAK_MATCH_MAX_DISTANCE) {
            log.info("Resolved watermark fingerprint candidate with weak match (distance={})", bestDistance);
            return Optional.of(new FingerprintMatch(
                best,
                extractedPayload,
                matchedPayload,
                "WEAK",
                bestDistance
            ));
        }

        log.info("Discarding fingerprint candidate due to excessive distance (distance={})", bestDistance);
        return Optional.empty();
    }

    private String normalizePayload(String raw) {
        if (raw == null) return "";
        String compact = raw.trim().replaceAll("\\s+", "");
        return compact.replaceAll("[^A-Za-z0-9+/=]", "");
    }

    private List<String> buildCandidates(String normalized) {
        LinkedHashSet<String> out = new LinkedHashSet<>();
        if (normalized == null || normalized.isBlank()) {
            return List.of();
        }
        out.add(normalized);
        if (normalized.length() == 32) {
            return new ArrayList<>(out);
        }
        if (normalized.length() > 32) {
            int totalWindows = normalized.length() - 32 + 1;
            int cap = Math.min(totalWindows, 128);
            for (int i = 0; i < cap; i++) {
                out.add(normalized.substring(i, i + 32));
            }
            out.add(normalized.substring(normalized.length() - 32));
        }
        return new ArrayList<>(out);
    }

    private int levenshtein(String a, String b) {
        int[][] dp = new int[a.length() + 1][b.length() + 1];
        for (int i = 0; i <= a.length(); i++) dp[i][0] = i;
        for (int j = 0; j <= b.length(); j++) dp[0][j] = j;
        for (int i = 1; i <= a.length(); i++) {
            for (int j = 1; j <= b.length(); j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                dp[i][j] = Math.min(
                    Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1),
                    dp[i - 1][j - 1] + cost
                );
            }
        }
        return dp[a.length()][b.length()];
    }
}
