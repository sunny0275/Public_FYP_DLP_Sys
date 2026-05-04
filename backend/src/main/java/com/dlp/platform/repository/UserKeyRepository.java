package com.dlp.platform.repository;

import com.dlp.platform.entity.UserKey;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserKeyRepository extends JpaRepository<UserKey, Long> {

    Optional<UserKey> findByUserId(Long userId);

    boolean existsByUserId(Long userId);
}
