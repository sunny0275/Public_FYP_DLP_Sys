package com.dlp.platform.dto.classification;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Request body for uploading custom samples (content + label) to build Vertex AI tuning JSONL and upload to GCS.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CustomTuningSampleRequest {

    private List<SampleEntry> samples;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SampleEntry {
        /** Document text content (e.g. markdown or plain text). */
        private String content;
        /** Expected classification level: PUBLIC, INTERNAL, CONFIDENTIAL, STRICTLY_CONFIDENTIAL */
        private String expectedLevel;
    }
}
