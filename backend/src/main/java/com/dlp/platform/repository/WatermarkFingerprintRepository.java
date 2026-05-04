package com.dlp.platform.repository;

import com.dlp.platform.entity.WatermarkFingerprint;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface WatermarkFingerprintRepository extends JpaRepository<WatermarkFingerprint, Long> {

    Optional<WatermarkFingerprint> findByPayloadHash(String payloadHash);

    Optional<WatermarkFingerprint> findByShortCode(String shortCode);

    Optional<WatermarkFingerprint> findByShortCodeIgnoreCase(String shortCode);

    List<WatermarkFingerprint> findByShortCodeStartsWithIgnoreCase(String shortCodePrefix);

    Optional<WatermarkFingerprint> findByUserId(Long userId);

    List<WatermarkFingerprint> findAllByUserId(Long userId);

    List<WatermarkFingerprint> findByDocumentId(Long documentId);

    List<WatermarkFingerprint> findTop500ByOrderByCreatedAtDesc();

    List<WatermarkFingerprint> findByCreatedAtBetween(LocalDateTime start, LocalDateTime end);
}

