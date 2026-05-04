package com.dlp.platform.repository;

import com.dlp.platform.entity.UserCertificate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserCertificateRepository extends JpaRepository<UserCertificate, Long> {
    Optional<UserCertificate> findTopByUserIdAndStatusOrderByNotAfterDesc(Long userId, UserCertificate.Status status);
    Optional<UserCertificate> findBySerialHex(String serialHex);
    List<UserCertificate> findByStatus(UserCertificate.Status status);
    List<UserCertificate> findByUserIdOrderByNotAfterDesc(Long userId);
}


