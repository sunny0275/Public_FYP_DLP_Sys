package com.dlp.platform.repository;

import com.dlp.platform.entity.DocumentKey;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DocumentKeyRepository extends JpaRepository<DocumentKey, Long> {

    Optional<DocumentKey> findByDocumentId(Long documentId);

    List<DocumentKey> findByOwnerUserId(Long ownerUserId);
}

