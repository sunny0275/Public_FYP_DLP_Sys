package com.dlp.platform.repository;

import com.dlp.platform.entity.KeyRecoveryJob;
import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.data.domain.Pageable;

import java.util.List;

public interface KeyRecoveryJobRepository extends JpaRepository<KeyRecoveryJob, Long> {

    List<KeyRecoveryJob> findByUserIdOrderByStartedAtDesc(Long userId, Pageable pageable);
}
