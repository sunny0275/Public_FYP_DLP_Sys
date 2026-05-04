package com.dlp.platform.repository;

import com.dlp.platform.entity.UebaRule;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UebaRuleRepository extends JpaRepository<UebaRule, Long> {

    List<UebaRule> findByRuleTypeAndEnabledOrderByPriorityAsc(String ruleType, Boolean enabled);

    List<UebaRule> findByEnabledOrderByRuleTypeAscPriorityAsc(Boolean enabled);

    Page<UebaRule> findByRuleType(String ruleType, Pageable pageable);

    Page<UebaRule> findAllByOrderByRuleTypeAscPriorityAsc(Pageable pageable);
}
