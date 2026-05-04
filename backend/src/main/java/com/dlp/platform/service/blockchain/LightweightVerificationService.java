package com.dlp.platform.service.blockchain;

import com.dlp.platform.entity.blockchain.MerkleBlock;
import com.dlp.platform.entity.blockchain.MerkleTransaction;
import com.dlp.platform.repository.blockchain.MerkleBlockRepository;
import com.dlp.platform.repository.blockchain.MerkleTransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Lightweight Verification Service - SPV-style client for blockchain verification.
 * 
 * This service provides:
 * - Merkle proof verification without downloading full blockchain
 * - Document watermark verification
 * - Chain integrity verification
 * - Lightweight client (mobile/edge) support
 * 
 * Architecture:
 * Traditional Blockchain:
 * ┌────────────────────────────────────────────────────┐
 * │ Full Node: Download ALL blocks (1TB+)              │
 * │ Client: Must trust node or run full node          │
 * └────────────────────────────────────────────────────┘
 * 
 * SPV Lightweight Client (This Service):
 * ┌────────────────────────────────────────────────────┐
 * │ Light Client: Download ONLY headers + proofs       │
 * │ Server: Provides Merkle proof for verification     │
 * │ Verification: Cryptographic proof without trust    │
 * └────────────────────────────────────────────────────┘
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class LightweightVerificationService {

    private final MerkleBlockRepository merkleBlockRepository;
    private final MerkleTransactionRepository merkleTransactionRepository;

    @Value("${blockchain.enabled:true}")
    private boolean blockchainEnabled;

    @Value("${blockchain.lightweight-client.enabled:true}")
    private boolean lightweightClientEnabled;

    @PostConstruct
    public void init() {
        log.info("LightweightVerificationService initialized: blockchain={}, lightweightClient={}",
            blockchainEnabled, lightweightClientEnabled);
    }

    /**
     * Verify a document's watermark using Merkle proof (SPV-style).
     * 
     * This is the main verification method for lightweight clients.
     * Only requires:
     * - Document ID
     * - Expected content hash
     * - Merkle proof (fetched from server)
     * 
     * @param documentId Document ID to verify
     * @param expectedHash Expected content hash
     * @return Verification result with Merkle proof if successful
     */
    public VerificationResult verifyDocument(Long documentId, String expectedHash) {
        if (!blockchainEnabled) {
            log.debug("Blockchain disabled, returning local-only verification");
            return VerificationResult.localOnly();
        }

        try {
            // 1. Find the latest transaction for this document
            Optional<MerkleTransaction> txOpt = merkleTransactionRepository
                .findTopByDocumentIdOrderByCreatedAtDesc(documentId);

            if (txOpt.isEmpty()) {
                log.info("No blockchain record found for document {}", documentId);
                return VerificationResult.notFound();
            }

            MerkleTransaction tx = txOpt.get();

            // 2. Verify the transaction hash matches
            if (!tx.getLeafHash().equals(expectedHash)) {
                log.warn("Hash mismatch for document {}: expected={}, actual={}",
                    documentId, expectedHash, tx.getLeafHash());
                return VerificationResult.hashMismatch();
            }

            // 3. Get the block
            Optional<MerkleBlock> blockOpt = merkleBlockRepository.findById(tx.getBlockId());

            if (blockOpt.isEmpty()) {
                log.error("Block not found for transaction: blockId={}", tx.getBlockId());
                return VerificationResult.blockNotFound();
            }

            MerkleBlock block = blockOpt.get();

            // 4. Get Merkle proof
            List<String> merkleProof = tx.getMerkleProof();

            // 5. Verify Merkle proof
            boolean proofValid = verifyMerkleProof(
                tx.getLeafHash(),
                merkleProof,
                block.getMerkleRoot()
            );

            if (!proofValid) {
                log.error("Merkle proof verification failed for document {}", documentId);
                return VerificationResult.invalidProof();
            }

            // 6. Verify chain integrity
            boolean chainValid = verifyChainIntegrity(block);

            if (!chainValid) {
                log.error("Chain integrity check failed at block {}", block.getBlockNumber());
                return VerificationResult.chainInvalid();
            }

            // 7. Build verification response
            return VerificationResult.verified(
                tx.getTransactionHash(),
                block.getBlockNumber(),
                block.getMerkleRoot(),
                tx.getCreatedAt(),
                tx.getWatermarkType().name(),
                tx.getUserId(),
                tx.getIpAddress(),
                merkleProof
            );

        } catch (Exception e) {
            log.error("Verification failed for document {}: {}", documentId, e.getMessage(), e);
            return VerificationResult.error(e.getMessage());
        }
    }

    /**
     * Get Merkle proof for a document.
     * Used by lightweight clients to fetch proof data.
     */
    public Optional<MerkleProofResponse> getMerkleProof(Long documentId) {
        if (!blockchainEnabled) {
            return Optional.empty();
        }

        Optional<MerkleTransaction> txOpt = merkleTransactionRepository
            .findTopByDocumentIdOrderByCreatedAtDesc(documentId);

        if (txOpt.isEmpty()) {
            return Optional.empty();
        }

        MerkleTransaction tx = txOpt.get();
        Optional<MerkleBlock> blockOpt = merkleBlockRepository.findById(tx.getBlockId());

        if (blockOpt.isEmpty()) {
            return Optional.empty();
        }

        MerkleBlock block = blockOpt.get();

        return Optional.of(MerkleProofResponse.builder()
            .documentId(documentId)
            .transactionHash(tx.getTransactionHash())
            .leafHash(tx.getLeafHash())
            .merkleRoot(block.getMerkleRoot())
            .blockNumber(block.getBlockNumber())
            .blockHash(block.getBlockHash())
            .previousBlockHash(block.getPreviousBlockHash())
            .merkleProof(tx.getMerkleProof())
            .timestamp(tx.getCreatedAt())
            .confirmed(block.isConfirmed())
            .build());
    }

    /**
     * Get blockchain statistics for lightweight clients.
     */
    public ChainStats getChainStats() {
        if (!blockchainEnabled) {
            return ChainStats.disabled();
        }

        long totalBlocks = merkleBlockRepository.count();
        long totalTransactions = merkleTransactionRepository.count();
        long confirmedTransactions = merkleTransactionRepository.findByStatusOrderByCreatedAtAsc(
            MerkleTransaction.TransactionStatus.CONFIRMED
        ).size();

        Optional<MerkleBlock> latestBlock = merkleBlockRepository.findTopByOrderByBlockNumberDesc();

        return ChainStats.builder()
            .enabled(true)
            .totalBlocks(totalBlocks)
            .totalTransactions(totalTransactions)
            .confirmedTransactions(confirmedTransactions)
            .latestBlockNumber(latestBlock.map(MerkleBlock::getBlockNumber).orElse(0L))
            .latestBlockHash(latestBlock.map(MerkleBlock::getBlockHash).orElse(null))
            .chainCreatedAt(latestBlock.map(MerkleBlock::getCreatedAt).orElse(null))
            .build();
    }

    /**
     * Verify Merkle proof locally.
     * 
     * Given a leaf hash and proof path, verify it leads to the Merkle root.
     */
    public boolean verifyMerkleProof(String leafHash, List<String> proof, String merkleRoot) {
        if (proof == null || proof.isEmpty()) {
            log.debug("Empty proof, verifying hash directly");
            return leafHash.equals(merkleRoot);
        }

        String currentHash = leafHash;

        for (String sibling : proof) {
            String combined;
            if (currentHash.compareTo(sibling) < 0) {
                combined = currentHash + sibling;
            } else {
                combined = sibling + currentHash;
            }
            currentHash = calculateHash(combined);
        }

        return currentHash.equals(merkleRoot);
    }

    /**
     * Verify the integrity of the blockchain up to the given block.
     */
    public boolean verifyChainIntegrity(MerkleBlock targetBlock) {
        if (targetBlock == null) {
            return false;
        }

        // Check if block is confirmed
        if (!targetBlock.isConfirmed()) {
            log.warn("Block #{} is not confirmed", targetBlock.getBlockNumber());
            return false;
        }

        // Verify block hash
        String expectedHash = calculateHash(
            String.join("|",
                targetBlock.getMerkleRoot(),
                targetBlock.getPreviousBlockHash(),
                String.valueOf(targetBlock.getTransactionCount())
            )
        );

        if (!expectedHash.equals(targetBlock.getBlockHash())) {
            log.error("Block hash mismatch: expected={}, actual={}", expectedHash, targetBlock.getBlockHash());
            return false;
        }

        // Verify chain by checking previous blocks up to genesis
        Long currentBlockNumber = targetBlock.getBlockNumber();

        while (currentBlockNumber > 1) {
            currentBlockNumber--;
            Optional<MerkleBlock> prevBlockOpt = merkleBlockRepository.findByBlockNumber(currentBlockNumber);

            if (prevBlockOpt.isEmpty()) {
                log.error("Previous block not found: #{}", currentBlockNumber);
                return false;
            }

            MerkleBlock prevBlock = prevBlockOpt.get();

            if (!prevBlock.getBlockHash().equals(targetBlock.getPreviousBlockHash())) {
                log.error("Chain broken at block #{}", currentBlockNumber);
                return false;
            }

            targetBlock = prevBlock;
        }

        return true;
    }

    /**
     * Get full chain for audit purposes.
     */
    public List<ChainBlock> getFullChain() {
        if (!blockchainEnabled) {
            return Collections.emptyList();
        }

        return merkleBlockRepository.findAll().stream()
            .sorted(Comparator.comparing(MerkleBlock::getBlockNumber))
            .map(block -> ChainBlock.builder()
                .blockNumber(block.getBlockNumber())
                .blockHash(block.getBlockHash())
                .previousBlockHash(block.getPreviousBlockHash())
                .merkleRoot(block.getMerkleRoot())
                .transactionCount(block.getTransactionCount())
                .status(block.getStatus().name())
                .createdAt(block.getCreatedAt())
                .confirmedAt(block.getConfirmedAt())
                .build())
            .collect(Collectors.toList());
    }

    /**
     * Calculate SHA-256 hash.
     */
    public String calculateHash(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return bytesToHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    // ===== DTO Classes =====

    /**
     * Verification result for SPV clients.
     */
    @lombok.Data
    @lombok.Builder
    public static class VerificationResult {
        private boolean verified;
        private boolean localOnly;
        private String status; // VERIFIED, NOT_FOUND, HASH_MISMATCH, INVALID_PROOF, CHAIN_INVALID, ERROR
        private String transactionHash;
        private Long blockNumber;
        private String merkleRoot;
        private LocalDateTime timestamp;
        private String watermarkType;
        private Long userId;
        private String ipAddress;
        private List<String> merkleProof;
        private String errorMessage;

        public static VerificationResult verified(String txHash, Long blockNum, String root,
                LocalDateTime ts, String type, Long uid, String ip, List<String> proof) {
            return VerificationResult.builder()
                .verified(true)
                .status("VERIFIED")
                .transactionHash(txHash)
                .blockNumber(blockNum)
                .merkleRoot(root)
                .timestamp(ts)
                .watermarkType(type)
                .userId(uid)
                .ipAddress(ip)
                .merkleProof(proof)
                .build();
        }

        public static VerificationResult notFound() {
            return VerificationResult.builder()
                .verified(false)
                .status("NOT_FOUND")
                .build();
        }

        public static VerificationResult hashMismatch() {
            return VerificationResult.builder()
                .verified(false)
                .status("HASH_MISMATCH")
                .build();
        }

        public static VerificationResult invalidProof() {
            return VerificationResult.builder()
                .verified(false)
                .status("INVALID_PROOF")
                .build();
        }

        public static VerificationResult blockNotFound() {
            return VerificationResult.builder()
                .verified(false)
                .status("BLOCK_NOT_FOUND")
                .build();
        }

        public static VerificationResult chainInvalid() {
            return VerificationResult.builder()
                .verified(false)
                .status("CHAIN_INVALID")
                .build();
        }

        public static VerificationResult localOnly() {
            return VerificationResult.builder()
                .verified(true)
                .localOnly(true)
                .status("LOCAL_ONLY")
                .build();
        }

        public static VerificationResult error(String msg) {
            return VerificationResult.builder()
                .verified(false)
                .status("ERROR")
                .errorMessage(msg)
                .build();
        }
    }

    /**
     * Merkle proof response for lightweight clients.
     */
    @lombok.Data
    @lombok.Builder
    public static class MerkleProofResponse {
        private Long documentId;
        private String transactionHash;
        private String leafHash;
        private String merkleRoot;
        private Long blockNumber;
        private String blockHash;
        private String previousBlockHash;
        private List<String> merkleProof;
        private LocalDateTime timestamp;
        private boolean confirmed;
    }

    /**
     * Blockchain statistics.
     */
    @lombok.Data
    @lombok.Builder
    public static class ChainStats {
        private boolean enabled;
        private long totalBlocks;
        private long totalTransactions;
        private long confirmedTransactions;
        private Long latestBlockNumber;
        private String latestBlockHash;
        private LocalDateTime chainCreatedAt;

        public static ChainStats disabled() {
            return ChainStats.builder()
                .enabled(false)
                .build();
        }
    }

    /**
     * Chain block info for audit.
     */
    @lombok.Data
    @lombok.Builder
    public static class ChainBlock {
        private Long blockNumber;
        private String blockHash;
        private String previousBlockHash;
        private String merkleRoot;
        private int transactionCount;
        private String status;
        private LocalDateTime createdAt;
        private LocalDateTime confirmedAt;
    }
}
