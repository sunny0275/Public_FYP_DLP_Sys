package com.dlp.platform.controller.blockchain;

import com.dlp.platform.dto.common.ApiResponse;
import com.dlp.platform.service.blockchain.LightweightVerificationService;
import com.dlp.platform.service.blockchain.LightweightVerificationService.ChainBlock;
import com.dlp.platform.service.blockchain.LightweightVerificationService.ChainStats;
import com.dlp.platform.service.blockchain.LightweightVerificationService.MerkleProofResponse;
import com.dlp.platform.service.blockchain.LightweightVerificationService.VerificationResult;
import com.dlp.platform.service.blockchain.WatermarkBatchService;
import com.dlp.platform.service.blockchain.WatermarkBatchService.BatchResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * REST Controller for blockchain and verification operations.
 * 
 * Provides endpoints for:
 * - Lightweight client verification (SPV-style)
 * - Merkle proof retrieval
 * - Blockchain statistics
 * - Batch management
 */
@RestController
@RequestMapping("/api/blockchain")
@RequiredArgsConstructor
@Slf4j
public class BlockchainController {

    private final LightweightVerificationService verificationService;
    private final WatermarkBatchService batchService;

    // ==================== Verification Endpoints ====================

    /**
     * Verify a document's watermark using Merkle proof (SPV-style).
     * 
     * This is the main verification endpoint for lightweight clients.
     * No authentication required (public verification).
     * 
     * @param documentId Document ID to verify
     * @param hash Content hash of the document
     * @return Verification result
     */
    @GetMapping("/verify/document/{documentId}")
    public ResponseEntity<ApiResponse<VerificationResult>> verifyDocument(
            @PathVariable Long documentId,
            @RequestParam String hash) {
        
        log.info("Verification request for document {} with hash {}", documentId, hash);
        
        VerificationResult result = verificationService.verifyDocument(documentId, hash);
        
        if (result.isVerified()) {
            return ResponseEntity.ok(ApiResponse.success("Document verified successfully", result));
        } else {
            return ResponseEntity.badRequest().body(ApiResponse.error(result.getStatus(), result.getStatus()));
        }
    }

    /**
     * Get Merkle proof for a document.
     * 
     * Used by lightweight clients to fetch proof data for offline verification.
     * No authentication required (public proof).
     * 
     * @param documentId Document ID
     * @return Merkle proof data
     */
    @GetMapping("/proof/document/{documentId}")
    public ResponseEntity<ApiResponse<MerkleProofResponse>> getMerkleProof(
            @PathVariable Long documentId) {
        
        log.debug("Fetching Merkle proof for document {}", documentId);
        
        Optional<MerkleProofResponse> proof = verificationService.getMerkleProof(documentId);
        
        if (proof.isPresent()) {
            return ResponseEntity.ok(ApiResponse.success(proof.get()));
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Verify Merkle proof locally (client-side).
     * 
     * Allows clients to verify a proof without trusting the server.
     * 
     * @param request Proof verification request
     * @return Verification result
     */
    @PostMapping("/verify/proof")
    public ResponseEntity<ApiResponse<Map<String, Object>>> verifyProofLocally(
            @RequestBody Map<String, Object> request) {
        
        String leafHash = (String) request.get("leafHash");
        @SuppressWarnings("unchecked")
        List<String> proof = (List<String>) request.get("proof");
        String merkleRoot = (String) request.get("merkleRoot");
        
        boolean isValid = verificationService.verifyMerkleProof(leafHash, proof, merkleRoot);
        
        Map<String, Object> result = Map.of(
            "valid", isValid,
            "leafHash", leafHash,
            "merkleRoot", merkleRoot,
            "proofLength", proof != null ? proof.size() : 0
        );
        
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    // ==================== Chain Status Endpoints ====================

    /**
     * Get blockchain statistics.
     * 
     * Public endpoint for checking blockchain status.
     * 
     * @return Chain statistics
     */
    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<ChainStats>> getChainStats() {
        ChainStats stats = verificationService.getChainStats();
        return ResponseEntity.ok(ApiResponse.success(stats));
    }

    /**
     * Get the full blockchain (for audit purposes).
     * 
     * Requires ADMIN role.
     * 
     * @return List of all blocks in the chain
     */
    @GetMapping("/chain")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<ApiResponse<List<ChainBlock>>> getFullChain() {
        List<ChainBlock> chain = verificationService.getFullChain();
        return ResponseEntity.ok(ApiResponse.success(chain));
    }

    /**
     * Verify chain integrity.
     * 
     * Checks if the blockchain is valid and has not been tampered with.
     * Requires ADMIN role.
     * 
     * @param fromBlock Start block number (optional)
     * @param toBlock End block number (optional)
     * @return Verification result
     */
    @GetMapping("/chain/verify")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> verifyChain(
            @RequestParam(required = false) Long fromBlock,
            @RequestParam(required = false) Long toBlock) {
        
        List<ChainBlock> chain = verificationService.getFullChain();
        
        boolean isValid = true;
        String message = "Chain integrity verified";
        
        // Check consecutive blocks
        for (int i = 1; i < chain.size(); i++) {
            ChainBlock current = chain.get(i);
            ChainBlock previous = chain.get(i - 1);
            
            if (!current.getPreviousBlockHash().equals(previous.getBlockHash())) {
                isValid = false;
                message = "Chain broken at block " + current.getBlockNumber();
                break;
            }
        }
        
        Map<String, Object> result = Map.of(
            "valid", isValid,
            "message", message,
            "totalBlocks", chain.size(),
            "fromBlock", fromBlock != null ? fromBlock : 1,
            "toBlock", toBlock != null ? toBlock : (chain.isEmpty() ? 0 : chain.get(chain.size() - 1).getBlockNumber())
        );
        
        if (isValid) {
            return ResponseEntity.ok(ApiResponse.success("Chain integrity verified", result));
        } else {
            return ResponseEntity.badRequest().body(ApiResponse.error(message, message));
        }
    }

    // ==================== Batch Management Endpoints ====================

    /**
     * Get batch queue status.
     * 
     * Public endpoint for checking pending watermarks.
     * 
     * @return Batch statistics
     */
    @GetMapping("/batch/status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getBatchStatus() {
        Map<String, Object> stats = batchService.getStats();
        return ResponseEntity.ok(ApiResponse.success(stats));
    }

    /**
     * Trigger manual batch submission.
     * 
     * Requires ADMIN role.
     * 
     * @return Batch submission result
     */
    @PostMapping("/batch/submit")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<ApiResponse<BatchResult>> submitBatch() {
        log.info("Manual batch submission triggered");
        BatchResult result = batchService.submitBatch();
        
        if (result.isSuccess()) {
            return ResponseEntity.ok(ApiResponse.success("Batch submitted: block #" + result.getBlockNumber(), result));
        } else if (result.isDisabled()) {
            return ResponseEntity.ok(ApiResponse.success("Blockchain disabled", result));
        } else if (result.isInProgress()) {
            return ResponseEntity.accepted().body(ApiResponse.<BatchResult>error("Batch submission already in progress", "IN_PROGRESS"));
        } else {
            return ResponseEntity.badRequest().body(ApiResponse.error("Batch submission failed: " + result.getError(), result.getError()));
        }
    }

    /**
     * Health check for blockchain service.
     * 
     * @return Service status
     */
    @GetMapping("/health")
    public ResponseEntity<ApiResponse<Map<String, Object>>> healthCheck() {
        ChainStats stats = verificationService.getChainStats();
        Map<String, Object> batchStats = batchService.getStats();
        
        Map<String, Object> health = Map.of(
            "blockchainEnabled", stats.isEnabled(),
            "totalBlocks", stats.getTotalBlocks(),
            "totalTransactions", stats.getTotalTransactions(),
            "pendingInQueue", batchStats.get("queueSize"),
            "status", stats.isEnabled() ? "HEALTHY" : "DISABLED"
        );
        
        return ResponseEntity.ok(ApiResponse.success(health));
    }
}
