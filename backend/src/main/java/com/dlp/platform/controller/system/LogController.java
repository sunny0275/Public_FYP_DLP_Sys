package com.dlp.platform.controller.system;

import com.dlp.platform.dto.common.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Minimal log endpoints for Admin dashboard.
 *
 * A real implementation should query a database or centralized logging system.
 * For now we return a safe empty result to avoid 500 errors.
 */
@Slf4j
@RestController
@RequestMapping("/logs")
public class LogController {

    /**
     * GET /api/logs/recent
     */
    @GetMapping("/recent")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getRecentLogs() {
        // Returning an empty list is sufficient for now (frontend expects 200 + array shape)
        return ResponseEntity.ok(ApiResponse.success("Logs fetched", Collections.emptyList()));
    }

    /**
     * GET /api/logs/export?range=24h
     */
    @GetMapping("/export")
    public ResponseEntity<ApiResponse<Map<String, Object>>> exportLogs(
            @RequestParam(name = "range", defaultValue = "24h") String range
    ) {
        Map<String, Object> data = new HashMap<>();
        data.put("range", range);
        data.put("generatedAt", Instant.now().toString());
        data.put("items", Collections.emptyList());

        return ResponseEntity.ok(ApiResponse.success("Log export ready", data));
    }
}


