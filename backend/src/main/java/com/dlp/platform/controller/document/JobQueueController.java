package com.dlp.platform.controller.document;

import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.dto.document.UploadJobResponse;
import com.dlp.platform.service.document.UploadJobService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Job queue endpoints for Admin dashboard monitoring.
 */
@Slf4j
@RestController
@RequestMapping("/jobs")
@RequiredArgsConstructor
public class JobQueueController {

  private final UploadJobService uploadJobService;

  /**
   * GET /api/jobs/queue - return recent / active upload jobs
   */
  @GetMapping("/queue")
  public ResponseEntity<ApiResponse<List<UploadJobResponse>>> getJobQueue() {
    try {
      List<UploadJobResponse> jobs = uploadJobService.getActiveJobs();
      return ResponseEntity.ok(ApiResponse.success("Job queue fetched", jobs));
    } catch (Exception e) {
      log.error("Failed to fetch job queue", e);
      return ResponseEntity.internalServerError()
        .body(ApiResponse.error("Failed to fetch job queue", e.getMessage()));
    }
  }

  /**
   * GET /api/jobs/{id} - return upload/re-encryption job status detail
   */
  @GetMapping("/{id}")
  public ResponseEntity<ApiResponse<UploadJobResponse>> getJobById(@PathVariable Long id) {
    try {
      UploadJobResponse job = uploadJobService.getJobStatus(id);
      return ResponseEntity.ok(ApiResponse.success("Job status fetched", job));
    } catch (Exception e) {
      log.error("Failed to fetch job {}", id, e);
      return ResponseEntity.internalServerError()
        .body(ApiResponse.error("Failed to fetch job status", e.getMessage()));
    }
  }
}


