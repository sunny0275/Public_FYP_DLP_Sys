package com.dlp.platform.controller.admin;

import com.dlp.platform.dto.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;

/**
 * Department management controller
 * Provides department list for dropdowns in user creation, document upload, etc.
 */
@Slf4j
@RestController
@RequestMapping("/departments")
@RequiredArgsConstructor
public class DepartmentController {

    /**
     * Predefined list of departments in the organization
     */
    private static final List<String> DEPARTMENTS = Arrays.asList(
            "IT Department",
            "Finance",
            "HR"
    );

    /**
     * GET /api/departments
     * Returns list of available departments
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<String>>> getDepartments() {
        log.debug("Fetching department list");
        return ResponseEntity.ok(ApiResponse.success("Departments retrieved successfully", DEPARTMENTS));
    }
}

