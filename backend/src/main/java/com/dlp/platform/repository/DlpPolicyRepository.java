package com.dlp.platform.repository;

import com.dlp.platform.entity.DlpPolicy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DlpPolicyRepository extends JpaRepository<DlpPolicy, Long> {

    /**
     * Find active policy by key
     */
    Optional<DlpPolicy> findByPolicyKeyAndActiveTrue(String policyKey);

    /**
     * Find all versions of a policy by key, ordered by version descending
     */
    List<DlpPolicy> findByPolicyKeyOrderByVersionDesc(String policyKey);

    /**
     * Find all active policies
     */
    List<DlpPolicy> findByActiveTrue();

    /**
     * Find all active policies by category
     */
    List<DlpPolicy> findByCategoryAndActiveTrue(String category);

    /**
     * Find specific version of a policy
     */
    Optional<DlpPolicy> findByPolicyKeyAndVersion(String policyKey, Integer version);

    /**
     * Get latest version number for a policy key
     */
    @Query("SELECT COALESCE(MAX(p.version), 0) FROM DlpPolicy p WHERE p.policyKey = :policyKey")
    Integer findMaxVersionByPolicyKey(String policyKey);
}
