package com.dlp.platform.dto.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for Watermark Settings configuration
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WatermarkSettingsDto {
    private String style;
    private WatermarkContent content;
    private Double opacity;
    private String position;
    private Integer fontSize;
    private String fontColor;
    private String fontFamily;
    private Boolean includeTimestamp;
    private Boolean includeIpAddress;
    private Boolean includeDocumentId;
    private Boolean includeUsername;
    private String customText;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WatermarkContent {
        private Boolean showUsername;
        private Boolean showTimestamp;
        private Boolean showIpAddress;
        private Boolean showDocumentId;
        private String customTemplate;
    }
}
