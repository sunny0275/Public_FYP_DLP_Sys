package com.dlp.platform.repository;

import com.dlp.platform.entity.ClassificationTuningExample;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClassificationTuningExampleRepository extends JpaRepository<ClassificationTuningExample, Long> {

    List<ClassificationTuningExample> findAllByOrderByCreatedAtAsc();

    long countByDocumentId(Long documentId);
}
