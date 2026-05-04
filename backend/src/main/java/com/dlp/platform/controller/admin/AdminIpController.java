package com.dlp.platform.controller.admin;

import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.entity.User;
import com.dlp.platform.service.admin.IpLoginAttemptService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Admin controller for managing blocked IP addresses.
 * Provides endpoints to view and unblock IP addresses that were blocked
 * by UEBA security policies or failed login attempts.
 */
@RestController
@RequestMapping("/admin/ip")
@Slf4j
@RequiredArgsConstructor
public class AdminIpController {

    private final IpLoginAttemptService ipLoginAttemptService;

    /**
     * GET /api/admin/ip/blocked - List all blocked IP addresses
     */
    @GetMapping("/blocked")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getBlockedIps(
            @AuthenticationPrincipal User currentUser) {

        log.info("Admin {} requesting blocked IPs list", currentUser.getAccountId());

        Map<String, IpLoginAttemptService.IpStatusInfo> blockedIps = ipLoginAttemptService.getBlockedIps();

        Map<String, Object> result = Map.of(
                "blockedIps", blockedIps,
                "totalCount", blockedIps.size()
        );

        return ResponseEntity.ok(ApiResponse.success(
                "Retrieved " + blockedIps.size() + " blocked IP(s)",
                result
        ));
    }

    /**
     * POST /api/admin/ip/unblock - Unblock a specific IP address
     * Body: { "ipAddress": "192.168.1.1" }
     */
    @PostMapping("/unblock")
    public ResponseEntity<ApiResponse<Void>> unblockIp(
            @RequestBody Map<String, String> request,
            @AuthenticationPrincipal User currentUser) {

        String ipAddress = request.get("ipAddress");
        if (ipAddress == null || ipAddress.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("IP address is required"));
        }

        log.info("Admin {} unblocking IP: {}", currentUser.getAccountId(), ipAddress);

        ipLoginAttemptService.unblockIp(ipAddress);

        return ResponseEntity.ok(ApiResponse.success(
                "IP " + ipAddress + " has been unblocked",
                null
        ));
    }

    /**
     * POST /api/admin/ip/block - Block an IP address manually
     * Body: { "ipAddress": "192.168.1.1", "reason": "Manual block by admin" }
     */
    @PostMapping("/block")
    public ResponseEntity<ApiResponse<Void>> blockIp(
            @RequestBody Map<String, String> request,
            @AuthenticationPrincipal User currentUser) {

        String ipAddress = request.get("ipAddress");
        String reason = request.getOrDefault("reason", "Manual block by admin: " + currentUser.getAccountId());

        if (ipAddress == null || ipAddress.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("IP address is required"));
        }

        log.info("Admin {} blocking IP: {} - Reason: {}", currentUser.getAccountId(), ipAddress, reason);

        ipLoginAttemptService.blockIp(ipAddress, reason);

        return ResponseEntity.ok(ApiResponse.success(
                "IP " + ipAddress + " has been blocked",
                null
        ));
    }

    /**
     * POST /api/admin/ip/unblock-all - Unblock all IP addresses
     */
    @PostMapping("/unblock-all")
    public ResponseEntity<ApiResponse<Map<String, Object>>> unblockAllIps(
            @AuthenticationPrincipal User currentUser) {

        log.info("Admin {} unblocking all IPs", currentUser.getAccountId());

        Map<String, IpLoginAttemptService.IpStatusInfo> blockedBefore = ipLoginAttemptService.getBlockedIps();
        int countBefore = blockedBefore.size();

        blockedBefore.keySet().forEach(ipLoginAttemptService::unblockIp);

        Map<String, Object> result = Map.of(
                "unblockedCount", countBefore,
                "message", countBefore + " IP(s) have been unblocked"
        );

        return ResponseEntity.ok(ApiResponse.success(
                "All " + countBefore + " blocked IP(s) have been unblocked",
                result
        ));
    }
}
