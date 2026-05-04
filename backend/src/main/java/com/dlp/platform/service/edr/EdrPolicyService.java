package com.dlp.platform.service.edr;

import com.dlp.platform.entity.EdrPolicy;
import com.dlp.platform.entity.User;
import com.dlp.platform.repository.EdrPolicyRepository;
import com.dlp.platform.service.audit.AuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class EdrPolicyService {

    private final EdrPolicyRepository edrPolicyRepository;
    private final AuditService auditService;

    @Transactional(readOnly = true)
    public List<EdrPolicy> listPolicies() {
        return edrPolicyRepository.findAllByOrderByUpdatedAtDesc();
    }

    @Transactional(readOnly = true)
    public Optional<EdrPolicy> getPolicy(Long id) {
        return edrPolicyRepository.findById(id);
    }

    @Transactional
    public EdrPolicy createOrUpdatePolicy(Long id, String name, String description, String rulesJson, String status, User changedBy) {
        EdrPolicy policy;
        if (id != null) {
            policy = edrPolicyRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("EDR policy not found: " + id));
            policy.setName(name);
            policy.setDescription(description);
            policy.setRulesJson(rulesJson);
            if (status != null) policy.setStatus(status);
        } else {
            policy = EdrPolicy.builder()
                    .name(name)
                    .description(description)
                    .rulesJson(rulesJson != null ? rulesJson : "[]")
                    .status(status != null ? status : "DRAFT")
                    .createdBy(changedBy != null ? changedBy.getAccountId() : null)
                    .build();
        }
        policy = edrPolicyRepository.save(policy);
        auditService.logEvent(
                changedBy != null ? changedBy.getId() : null,
                changedBy != null ? changedBy.getAccountId() : "SYSTEM",
                id != null ? "UPDATE_EDR_POLICY" : "CREATE_EDR_POLICY",
                "EDR",
                "SUCCESS",
                "EDR policy " + policy.getName() + " " + (id != null ? "updated" : "created"),
                null, null, null
        );
        return policy;
    }

    @Transactional
    public void deletePolicy(Long id, User deletedBy) {
        EdrPolicy policy = edrPolicyRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("EDR policy not found: " + id));
        edrPolicyRepository.delete(policy);
        auditService.logEvent(
                deletedBy != null ? deletedBy.getId() : null,
                deletedBy != null ? deletedBy.getAccountId() : "SYSTEM",
                "DELETE_EDR_POLICY",
                "EDR",
                "SUCCESS",
                "EDR policy deleted: " + policy.getName(),
                null, null, null
        );
    }

    @Transactional
    public Map<String, Object> distributePolicy(Long id, User distributedBy) {
        EdrPolicy policy = edrPolicyRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("EDR policy not found: " + id));
        policy.setStatus("ACTIVE");
        edrPolicyRepository.save(policy);

        String dispatchId = UUID.randomUUID().toString();
        auditService.logEvent(
            distributedBy != null ? distributedBy.getId() : null,
            distributedBy != null ? distributedBy.getAccountId() : "SYSTEM",
            "DISTRIBUTE_EDR_POLICY",
            "EDR",
            "SUCCESS",
            "EDR policy distributed: id=" + id + ", name=" + policy.getName() + ", dispatchId=" + dispatchId,
            null, null, null
        );
        return Map.of(
            "policyId", id,
            "policyName", policy.getName(),
            "dispatchId", dispatchId,
            "status", "DISTRIBUTED",
            "distributedAt", LocalDateTime.now().toString()
        );
    }
}
