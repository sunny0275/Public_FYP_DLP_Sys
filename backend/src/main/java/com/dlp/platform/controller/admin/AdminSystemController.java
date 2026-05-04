package com.dlp.platform.controller.admin;

import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.entity.User;
import com.dlp.platform.service.document.DocumentWipeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin-level system utilities.
 */
@RestController
@RequestMapping("/admin/system")
@RequiredArgsConstructor
@Slf4j
public class AdminSystemController {

    private final DocumentWipeService documentWipeService;

    /**
     * POST /api/admin/system/wipe-documents
     */
    @PostMapping("/wipe-documents")
    public ResponseEntity<ApiResponse<String>> wipeDocuments(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(name = "confirm") String confirm,
            @RequestParam(name = "deleteFiles", defaultValue = "true") boolean deleteFiles) {

        if (!hasAdminRole(currentUser)) {
            throw new AccessDeniedException("Admin role required");
        }

        if (confirm == null || !confirm.equals("WIPE_DOCUMENTS")) {
            return ResponseEntity.badRequest()
                .body(ApiResponse.error("Confirmation required. Pass confirm=WIPE_DOCUMENTS"));
        }

        documentWipeService.wipeAllDocuments(deleteFiles);
        return ResponseEntity.ok(ApiResponse.success("Document library wiped", "Documents reset"));
    }

    private boolean hasAdminRole(User user) {
        if (user == null || user.getRoles() == null) return false;
        return user.getRoles().stream()
            .map(String::trim)
            .map(String::toUpperCase)
            .anyMatch(role -> role.equals("ADMIN") || role.equals("ROLE_ADMIN"));
    }
}


