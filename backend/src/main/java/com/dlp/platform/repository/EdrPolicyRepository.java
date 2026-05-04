package com.dlp.platform.repository;

import com.dlp.platform.entity.EdrPolicy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EdrPolicyRepository extends JpaRepository<EdrPolicy, Long> {

    List<EdrPolicy> findByStatusOrderByUpdatedAtDesc(String status);

    List<EdrPolicy> findAllByOrderByUpdatedAtDesc();
}
