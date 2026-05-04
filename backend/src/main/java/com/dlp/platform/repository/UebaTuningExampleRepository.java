package com.dlp.platform.repository;

import com.dlp.platform.entity.UebaTuningExample;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UebaTuningExampleRepository extends JpaRepository<UebaTuningExample, Long> {

    List<UebaTuningExample> findAllByOrderByCreatedAtAsc();

    long countByUserId(Long userId);
}
