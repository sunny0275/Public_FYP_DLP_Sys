package com.dlp.platform.service.classification;

import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageOptions;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.Map;

/**
 * Exports the classification tuning dataset (JSONL) and uploads it to Google Cloud Storage
 * for use with Vertex AI supervised fine-tuning (e.g. Gemini). Uses application default
 * credentials (ADC) or GOOGLE_APPLICATION_CREDENTIALS.
 */
@Service
@Slf4j
public class VertexTuningUploadService {

    @Value("${vertex.tuning.gcs-bucket:}")
    private String gcsBucket;

    @Value("${vertex.tuning.object-prefix:tuning/classification/}")
    private String objectPrefix;

    private final ClassificationTuningService classificationTuningService;

    public VertexTuningUploadService(ClassificationTuningService classificationTuningService) {
        this.classificationTuningService = classificationTuningService;
    }

    /**
     * Export tuning examples to JSONL and upload to GCS.
     *
     * @return Map with "gcsUri" (gs://bucket/object), "objectName", "exampleCount", "bytesUploaded".
     *         If bucket is not configured, returns "error" and "message" instead.
     */
    public Map<String, Object> exportAndUploadToGcs() {
        String bucket = (gcsBucket != null) ? gcsBucket.trim().replaceFirst("^gs://", "") : "";
        if (bucket.isBlank()) {
            log.warn("Vertex tuning GCS bucket not configured (vertex.tuning.gcs-bucket)");
            return Map.of(
                    "success", false,
                    "error", "GCS_NOT_CONFIGURED",
                    "message", "Set vertex.tuning.gcs-bucket (or VERTEX_TUNING_GCS_BUCKET) to enable auto-upload."
            );
        }

        String jsonl = classificationTuningService.exportToJsonl();
        long exampleCount = classificationTuningService.countExamples();
        if (exampleCount == 0) {
            return Map.of(
                    "success", true,
                    "exampleCount", 0L,
                    "message", "No tuning examples to export; upload skipped."
            );
        }

        String prefix = (objectPrefix != null && !objectPrefix.isBlank()) ? objectPrefix : "tuning/classification/";
        if (!prefix.endsWith("/")) {
            prefix = prefix + "/";
        }
        String objectName = prefix + "classification-tuning-dataset-" + DateTimeFormatter.ISO_INSTANT.format(Instant.now()).replace(":", "-") + ".jsonl";
        byte[] bytes = jsonl.getBytes(StandardCharsets.UTF_8);

        try {
            Storage storage = StorageOptions.getDefaultInstance().getService();
            BlobId blobId = BlobId.of(bucket, objectName);
            BlobInfo blobInfo = BlobInfo.newBuilder(blobId)
                    .setContentType("application/jsonl")
                    .build();
            storage.create(blobInfo, bytes);
            String gcsUri = "gs://" + bucket + "/" + objectName;
            log.info("Uploaded tuning dataset to {} ({} examples, {} bytes)", gcsUri, exampleCount, bytes.length);
            return Map.of(
                    "success", true,
                    "gcsUri", gcsUri,
                    "objectName", objectName,
                    "exampleCount", exampleCount,
                    "bytesUploaded", bytes.length,
                    "message", "Upload complete. Create a Vertex AI supervised tuning job with training data: " + gcsUri
            );
        } catch (Exception e) {
            log.error("Failed to upload tuning dataset to GCS: {}", e.getMessage());
            return Map.of(
                    "success", false,
                    "error", "UPLOAD_FAILED",
                    "message", e.getMessage(),
                    "exampleCount", exampleCount
            );
        }
    }

    public boolean isGcsConfigured() {
        if (gcsBucket == null || gcsBucket.isBlank()) return false;
        String b = gcsBucket.trim().replaceFirst("^gs://", "");
        return !b.isBlank();
    }

    /**
     * Upload raw JSONL content to GCS (e.g. seed dataset from sample documents).
     *
     * @param jsonlContent full JSONL string (one example per line)
     * @param objectSuffix  suffix for object name (e.g. "seed-samples") to form ...-{suffix}.jsonl
     * @param exampleCount  number of lines/examples (for response)
     * @return Map with gcsUri, objectName, exampleCount, bytesUploaded, or error
     */
    public Map<String, Object> uploadJsonlToGcs(String jsonlContent, String objectSuffix, long exampleCount) {
        String bucket = (gcsBucket != null) ? gcsBucket.trim().replaceFirst("^gs://", "") : "";
        if (bucket.isBlank()) {
            log.warn("Vertex tuning GCS bucket not configured (vertex.tuning.gcs-bucket)");
            return Map.of(
                    "success", false,
                    "error", "GCS_NOT_CONFIGURED",
                    "message", "Set vertex.tuning.gcs-bucket (or VERTEX_TUNING_GCS_BUCKET) to enable upload."
            );
        }
        String prefix = (objectPrefix != null && !objectPrefix.isBlank()) ? objectPrefix : "tuning/classification/";
        if (!prefix.endsWith("/")) prefix = prefix + "/";
        String suffix = (objectSuffix != null && !objectSuffix.isBlank()) ? objectSuffix : "dataset";
        String objectName = prefix + "classification-tuning-" + suffix + "-" + DateTimeFormatter.ISO_INSTANT.format(Instant.now()).replace(":", "-") + ".jsonl";
        byte[] bytes = jsonlContent.getBytes(StandardCharsets.UTF_8);
        try {
            Storage storage = StorageOptions.getDefaultInstance().getService();
            BlobId blobId = BlobId.of(bucket, objectName);
            BlobInfo blobInfo = BlobInfo.newBuilder(blobId).setContentType("application/jsonl").build();
            storage.create(blobInfo, bytes);
            String gcsUri = "gs://" + bucket + "/" + objectName;
            log.info("Uploaded tuning dataset to {} ({} examples, {} bytes)", gcsUri, exampleCount, bytes.length);
            return Map.of(
                    "success", true,
                    "gcsUri", gcsUri,
                    "objectName", objectName,
                    "exampleCount", exampleCount,
                    "bytesUploaded", bytes.length,
                    "message", "Upload complete. Create a Vertex AI supervised tuning job with training data: " + gcsUri
            );
        } catch (Exception e) {
            log.error("Failed to upload tuning dataset to GCS: {}", e.getMessage());
            return Map.of(
                    "success", false,
                    "error", "UPLOAD_FAILED",
                    "message", e.getMessage(),
                    "exampleCount", exampleCount
            );
        }
    }
}
