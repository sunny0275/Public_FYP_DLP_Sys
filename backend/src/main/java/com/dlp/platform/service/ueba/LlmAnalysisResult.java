package com.dlp.platform.service.ueba;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * UEBA分析结果数据类
 * 
 * 用于存储LLM分析事件的返回结果，包含：
 * - 异常判定 (isAnomalous)
 * - 置信度 (confidence)
 * - 异常类型 (anomalyType)
 * - 分析原因 (reason)
 * - 建议操作 (recommendedAction)
 * - 严重程度 (severity)
 * - 匹配的Tier等级 (tierMatched)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LlmAnalysisResult {
    
    /** 是否为异常行为 */
    private boolean isAnomalous;
    
    /** 置信度 0.0-1.0 */
    private double confidence;
    
    /** 异常类型：NONE|CREDENTIAL_ATTACK|DATA_EXFILTRATION|PRIVILEGE_ESCALATION|OFF_HOURS|UNAUTHORIZED_ACCESS|BEHAVIORAL_DEVIATION|SCREEN_RECORDING|ENDPOINT_TAMPERING */
    private String anomalyType;
    
    /** 分析原因描述 */
    private String reason;
    
    /** 建议操作：NONE|WARNING|RESTRICT|ALERT_ADMIN|DISABLE_ACCOUNT */
    private String recommendedAction;
    
    /** 严重程度：LOW|MEDIUM|HIGH|CRITICAL */
    private String severity;
    
    /** LLM原始响应（用于调试和分析） */
    private String llmRawResponse;
    
    /** 是否为回退到规则分析 */
    private boolean fallbackRuleBased;
    
    /** 匹配的Tier等级：1(无害), 2(严重), 2.5(上下文相关), 3(高危), 4(模糊需LLM分析) */
    private int tierMatched;
}
