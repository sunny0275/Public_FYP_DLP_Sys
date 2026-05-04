package com.dlp.platform.repository;

import com.dlp.platform.entity.Document;
import com.dlp.platform.entity.DocumentVersion;
import com.dlp.platform.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DocumentVersionRepository extends JpaRepository<DocumentVersion, Long> {

    List<DocumentVersion> findByDocumentOrderByVersionNumberDesc(Document document);

    Optional<DocumentVersion> findByDocumentAndVersionNumber(Document document, Integer versionNumber);

    @Query("SELECT v FROM DocumentVersion v WHERE v.document.id = :documentId ORDER BY v.versionNumber DESC")
    List<DocumentVersion> findByDocumentIdOrderByVersionNumberDesc(@Param("documentId") Long documentId);

    @Query("SELECT MAX(v.versionNumber) FROM DocumentVersion v WHERE v.document = :document")
    Optional<Integer> findMaxVersionNumber(@Param("document") Document document);

    @Modifying
    @Query("UPDATE DocumentVersion v SET v.createdBy = :newUser WHERE v.createdBy = :oldUser")
    int reassignCreatedBy(@Param("oldUser") User oldUser, @Param("newUser") User newUser);
}
