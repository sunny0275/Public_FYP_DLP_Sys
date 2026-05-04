package com.dlp.platform.service.ueba;

import com.dlp.platform.dto.ueba.UebaRuleDto;
import com.dlp.platform.entity.UebaRule;
import com.dlp.platform.repository.UebaRuleRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class UebaRuleService {

    private final UebaRuleRepository uebaRuleRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional(readOnly = true)
    public Page<UebaRuleDto> listRules(String ruleType, Pageable pageable) {
        Page<UebaRule> page = ruleType != null && !ruleType.isBlank()
                ? uebaRuleRepository.findByRuleType(ruleType, pageable)
                : uebaRuleRepository.findAllByOrderByRuleTypeAscPriorityAsc(pageable);
        return page.map(this::toDto);
    }

    @Transactional(readOnly = true)
    public List<UebaRuleDto> listEnabledByType(String ruleType) {
        return uebaRuleRepository.findByRuleTypeAndEnabledOrderByPriorityAsc(ruleType, true)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Optional<UebaRuleDto> getRule(Long id) {
        return uebaRuleRepository.findById(id).map(this::toDto);
    }

    @Transactional
    public UebaRuleDto createRule(UebaRuleDto dto, String changedBy, String changeReason) {
        UebaRule entity = toEntity(dto);
        entity.setId(null);
        entity.setVersion(1);
        entity.setChangedBy(changedBy);
        entity.setChangeReason(changeReason);
        if (entity.getPriority() == null) entity.setPriority(100);
        if (entity.getEnabled() == null) entity.setEnabled(true);
        entity = uebaRuleRepository.save(entity);
        return toDto(entity);
    }

    @Transactional
    public UebaRuleDto updateRule(Long id, UebaRuleDto dto, String changedBy, String changeReason) {
        UebaRule existing = uebaRuleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("UebaRule not found: " + id));
        existing.setName(dto.getName() != null ? dto.getName() : existing.getName());
        if (dto.getDescription() != null) existing.setDescription(dto.getDescription());
        if (dto.getRuleType() != null) existing.setRuleType(dto.getRuleType());
        if (dto.getConditionJson() != null) existing.setConditionJson(dto.getConditionJson());
        if (dto.getActionOrWeight() != null) existing.setActionOrWeight(dto.getActionOrWeight());
        if (dto.getWeight() != null) existing.setWeight(dto.getWeight());
        if (dto.getSeverity() != null) existing.setSeverity(dto.getSeverity());
        if (dto.getScopeJson() != null) existing.setScopeJson(dto.getScopeJson());
        if (dto.getPriority() != null) existing.setPriority(dto.getPriority());
        if (dto.getEnabled() != null) existing.setEnabled(dto.getEnabled());
        existing.setVersion(existing.getVersion() + 1);
        existing.setChangedBy(changedBy);
        existing.setChangeReason(changeReason);
        existing = uebaRuleRepository.save(existing);
        return toDto(existing);
    }

    @Transactional
    public void deleteRule(Long id) {
        if (!uebaRuleRepository.existsById(id)) throw new IllegalArgumentException("UebaRule not found: " + id);
        uebaRuleRepository.deleteById(id);
    }

    @Transactional
    public UebaRuleDto setEnabled(Long id, boolean enabled, String changedBy) {
        UebaRule r = uebaRuleRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("UebaRule not found: " + id));
        r.setEnabled(enabled);
        r.setChangedBy(changedBy);
        r.setChangeReason(enabled ? "Enabled" : "Disabled");
        r.setVersion(r.getVersion() + 1);
        return toDto(uebaRuleRepository.save(r));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getRiskAdaptivePolicy() {
        List<UebaRule> responseRules = uebaRuleRepository.findByRuleTypeAndEnabledOrderByPriorityAsc("RESPONSE", true);
        List<Map<String, Object>> thresholds = new ArrayList<>();
        for (UebaRule r : responseRules) {
            if (r.getConditionJson() == null) continue;
            try {
                Map<String, Object> cond = objectMapper.readValue(r.getConditionJson(), new TypeReference<Map<String, Object>>() {});
                Number min = cond.get("min") != null ? (Number) cond.get("min") : null;
                Number max = cond.get("max") != null ? (Number) cond.get("max") : null;
                String action = r.getActionOrWeight();
                Map<String, Object> band = new LinkedHashMap<>();
                if (min != null) band.put("min", min.intValue());
                if (max != null) band.put("max", max.intValue());
                band.put("action", action != null ? action : "NONE");
                thresholds.add(band);
            } catch (Exception e) {
                log.warn("Parse condition for rule {}: {}", r.getId(), e.getMessage());
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("thresholds", thresholds);
        out.put("updatedAt", responseRules.isEmpty() ? null :
                responseRules.stream().map(UebaRule::getUpdatedAt).max(LocalDateTime::compareTo).orElse(null));
        return out;
    }

    @Transactional
    public Map<String, Object> setRiskAdaptivePolicy(List<Map<String, Object>> thresholds, String changedBy) {
        List<UebaRule> existing = uebaRuleRepository.findByRuleTypeAndEnabledOrderByPriorityAsc("RESPONSE", true);
        for (UebaRule r : existing) uebaRuleRepository.delete(r);
        int priority = 0;
        for (Map<String, Object> band : thresholds) {
            Object minO = band.get("min");
            Object maxO = band.get("max");
            String action = band.get("action") != null ? band.get("action").toString() : "NONE";
            int min = minO instanceof Number ? ((Number) minO).intValue() : 0;
            int max = maxO instanceof Number ? ((Number) maxO).intValue() : 100;
            Map<String, Object> cond = new LinkedHashMap<>();
            cond.put("min", min);
            cond.put("max", max);
            try {
                String condJson = objectMapper.writeValueAsString(cond);
                UebaRule newRule = UebaRule.builder()
                        .name("Risk band " + min + "-" + max)
                        .ruleType("RESPONSE")
                        .conditionJson(condJson)
                        .actionOrWeight(action)
                        .priority(priority++)
                        .enabled(true)
                        .version(1)
                        .changedBy(changedBy)
                        .changeReason("Policy update")
                        .build();
                uebaRuleRepository.save(newRule);
            } catch (Exception e) {
                log.warn("Save threshold band: {}", e.getMessage());
            }
        }
        return getRiskAdaptivePolicy();
    }

    @Transactional(readOnly = true)
    public String getRecommendedAction(int score) {
        List<UebaRule> responseRules = uebaRuleRepository.findByRuleTypeAndEnabledOrderByPriorityAsc("RESPONSE", true);
        for (UebaRule r : responseRules) {
            if (r.getConditionJson() == null) continue;
            try {
                Map<String, Object> cond = objectMapper.readValue(r.getConditionJson(), new TypeReference<Map<String, Object>>() {});
                Number minN = cond.get("min") != null ? (Number) cond.get("min") : null;
                Number maxN = cond.get("max") != null ? (Number) cond.get("max") : null;
                int min = minN != null ? minN.intValue() : 0;
                int max = maxN != null ? maxN.intValue() : 100;
                if (score >= min && score <= max && r.getActionOrWeight() != null) {
                    return r.getActionOrWeight();
                }
            } catch (Exception e) {
                log.warn("Parse condition for rule {}: {}", r.getId(), e.getMessage());
            }
        }
        return "NONE";
    }

    private UebaRuleDto toDto(UebaRule e) {
        return UebaRuleDto.builder()
                .id(e.getId())
                .name(e.getName())
                .description(e.getDescription())
                .ruleType(e.getRuleType())
                .conditionJson(e.getConditionJson())
                .actionOrWeight(e.getActionOrWeight())
                .weight(e.getWeight())
                .severity(e.getSeverity())
                .scopeJson(e.getScopeJson())
                .priority(e.getPriority())
                .enabled(e.getEnabled())
                .version(e.getVersion())
                .changedBy(e.getChangedBy())
                .changeReason(e.getChangeReason())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .build();
    }

    private UebaRule toEntity(UebaRuleDto d) {
        UebaRule e = new UebaRule();
        e.setId(d.getId());
        e.setName(d.getName());
        e.setDescription(d.getDescription());
        e.setRuleType(d.getRuleType());
        e.setConditionJson(d.getConditionJson());
        e.setActionOrWeight(d.getActionOrWeight());
        e.setWeight(d.getWeight());
        e.setSeverity(d.getSeverity());
        e.setScopeJson(d.getScopeJson());
        e.setPriority(d.getPriority() != null ? d.getPriority() : 100);
        e.setEnabled(d.getEnabled() != null ? d.getEnabled() : true);
        e.setVersion(d.getVersion() != null ? d.getVersion() : 1);
        e.setChangedBy(d.getChangedBy());
        e.setChangeReason(d.getChangeReason());
        return e;
    }
}
