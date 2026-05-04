package com.dlp.platform.service.blockchain;

import com.dlp.platform.entity.blockchain.MerkleBlock;
import com.dlp.platform.entity.blockchain.MerkleTransaction;
import com.dlp.platform.entity.blockchain.MerkleTransaction.WatermarkType;
import com.dlp.platform.repository.blockchain.MerkleBlockRepository;
import com.dlp.platform.repository.blockchain.MerkleTransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Watermark Batch Service - Implements batched watermark registration.
 * 
 * This service provides:
 * - Queue watermarks for batch processing
 * - Build Merkle tree for batched transactions
 * - Create Merkle blocks (simulating blockchain batches)
 * - Automatic batch submission on size or time threshold
 * 
 * Architecture:
 * Watermark Queue → Merkle Tree → Merkle Block → Chain
 *     (pending)     (building)    (confirmed)
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class WatermarkBatchService {

    private final MerkleBlockRepository merkleBlockRepository;
    private final MerkleTransactionRepository merkleTransactionRepository;

    @Value("${blockchain.batch.size:50}")
    private int batchSize;

    @Value("${blockchain.batch.interval-ms:30000}")
    private long batchIntervalMs;

    @Value("${blockchain.enabled:true}")
    private boolean blockchainEnabled;

    private final ConcurrentLinkedQueue<WatermarkRecord> pendingWatermarks = new ConcurrentLinkedQueue<>();
    private final AtomicBoolean isProcessing = new AtomicBoolean(false);

    @PostConstruct
    public void init() {
        if (blockchainEnabled) {
            log.info("WatermarkBatchService initialized: batchSize={}, interval={}ms", batchSize, batchIntervalMs);
        } else {
            log.info("WatermarkBatchService initialized in DISABLED mode (no blockchain)");
        }
    }

    /**
     * Queue a watermark record for batch processing.
     * Automatically submits batch when size threshold is reached.
     */
    public void queueWatermark(WatermarkRecord record) {
        if (!blockchainEnabled) {
            log.debug("Blockchain disabled, skipping watermark queue");
            return;
        }

        pendingWatermarks.add(record);
        log.debug("Watermark queued for document {}: queue size = {}", record.getDocumentId(), pendingWatermarks.size());

        // Auto-submit when batch size reached
        if (pendingWatermarks.size() >= batchSize) {
            log.info("Batch size reached ({}), triggering batch submission", batchSize);
            submitBatch();
        }
    }

    /**
     * Scheduled batch submission - runs every 30 seconds by default.
     */
    @Scheduled(fixedRateString = "${blockchain.batch.interval-ms:30000}")
    public void scheduledBatchSubmit() {
        if (!blockchainEnabled) {
            return;
        }

        if (!pendingWatermarks.isEmpty()) {
            log.info("Scheduled batch submission triggered: {} pending watermarks", pendingWatermarks.size());
            submitBatch();
        }
    }

    /**
     * Submit pending watermarks as a batch (creates a Merkle block).
     */
    @Transactional
    public BatchResult submitBatch() {
        if (!blockchainEnabled) {
            return BatchResult.disabled();
        }

        if (!isProcessing.compareAndSet(false, true)) {
            log.warn("Batch submission already in progress, skipping");
            return BatchResult.inProgress();
        }

        try {
            List<WatermarkRecord> batch = drainBatch();
            if (batch.isEmpty()) {
                return BatchResult.empty();
            }

            log.info("Processing batch of {} watermarks", batch.size());

            // Get the previous block
            String previousHash = merkleBlockRepository.findTopByOrderByBlockNumberDesc()
                .map(MerkleBlock::getBlockHash)
                .orElse("0000000000000000000000000000000000000000000000000000000000000000");

            // Calculate Merkle root
            List<String> leafHashes = new ArrayList<>();
            for (WatermarkRecord record : batch) {
                leafHashes.add(record.getLeafHash());
            }
            String merkleRoot = calculateMerkleRoot(leafHashes);

            // Create block
            Long blockNumber = merkleBlockRepository.getNextBlockNumber();
            String blockData = String.join("|", merkleRoot, previousHash, String.valueOf(batch.size()));
            String blockHash = calculateHash(blockData);

            MerkleBlock block = MerkleBlock.builder()
                .blockNumber(blockNumber)
                .blockHash(blockHash)
                .merkleRoot(merkleRoot)
                .previousBlockHash(previousHash)
                .transactionCount(batch.size())
                .status(MerkleBlock.BlockStatus.PENDING)
                .build();

            block = merkleBlockRepository.save(block);

            // Create transactions and calculate Merkle proofs
            List<String> merkleProofs = calculateMerkleProofs(leafHashes, merkleRoot);

            for (int i = 0; i < batch.size(); i++) {
                WatermarkRecord record = batch.get(i);

                String txHash = calculateHash(
                    record.getDocumentId() + "|" +
                    record.getUserId() + "|" +
                    record.getTimestamp() + "|" +
                    record.getLeafHash()
                );

                MerkleTransaction tx = MerkleTransaction.builder()
                    .blockId(block.getId())
                    .transactionHash(txHash)
                    .leafIndex(i)
                    .leafHash(record.getLeafHash())
                    .documentId(record.getDocumentId())
                    .userId(record.getUserId())
                    .ipAddress(record.getIpAddress())
                    .watermarkType(record.getWatermarkType())
                    .status(MerkleTransaction.TransactionStatus.CONFIRMED)
                    .build();

                tx.setMerkleProofPath(merkleProofs.get(i));
                merkleTransactionRepository.save(tx);
            }

            // Confirm the block
            block.setStatus(MerkleBlock.BlockStatus.CONFIRMED);
            block.setConfirmedAt(LocalDateTime.now());
            merkleBlockRepository.save(block);

            log.info("Batch committed: block #{}, {} transactions, merkleRoot={}",
                blockNumber, batch.size(), merkleRoot);

            return BatchResult.success(blockNumber, merkleRoot, batch.size());

        } catch (Exception e) {
            log.error("Batch submission failed: {}", e.getMessage(), e);
            return BatchResult.error(e.getMessage());
        } finally {
            isProcessing.set(false);
        }
    }

    /**
     * Drain pending watermarks up to batch size.
     */
    private List<WatermarkRecord> drainBatch() {
        List<WatermarkRecord> batch = new ArrayList<>();
        WatermarkRecord record;

        while (batch.size() < batchSize && (record = pendingWatermarks.poll()) != null) {
            batch.add(record);
        }

        return batch;
    }

    /**
     * Calculate Merkle root from leaf hashes.
     * Uses SHA-256 and pair-wise hashing.
     */
    public String calculateMerkleRoot(List<String> leafHashes) {
        if (leafHashes == null || leafHashes.isEmpty()) {
            return "0000000000000000000000000000000000000000000000000000000000000000";
        }

        List<String> currentLevel = new ArrayList<>(leafHashes);

        while (currentLevel.size() > 1) {
            List<String> nextLevel = new ArrayList<>();

            for (int i = 0; i < currentLevel.size(); i += 2) {
                String left = currentLevel.get(i);
                String right = (i + 1 < currentLevel.size()) ? currentLevel.get(i + 1) : left;
                String combined = left + right;
                nextLevel.add(calculateHash(combined));
            }

            currentLevel = nextLevel;
        }

        return currentLevel.get(0);
    }

    /**
     * Calculate Merkle proof for each leaf.
     * Returns a list of proof paths, one for each leaf.
     */
    public List<String> calculateMerkleProofs(List<String> leafHashes, String merkleRoot) {
        List<String> proofs = new ArrayList<>();

        if (leafHashes == null || leafHashes.isEmpty()) {
            return proofs;
        }

        // Build tree structure
        List<List<String>> levels = new ArrayList<>();
        levels.add(new ArrayList<>(leafHashes));

        while (levels.get(levels.size() - 1).size() > 1) {
            List<String> current = levels.get(levels.size() - 1);
            List<String> next = new ArrayList<>();

            for (int i = 0; i < current.size(); i += 2) {
                String left = current.get(i);
                String right = (i + 1 < current.size()) ? current.get(i + 1) : left;
                next.add(calculateHash(left + right));
            }

            levels.add(next);
        }

        // Calculate proof for each leaf
        for (int leafIndex = 0; leafIndex < leafHashes.size(); leafIndex++) {
            List<String> proof = new ArrayList<>();

            for (int level = 0; level < levels.size() - 1; level++) {
                List<String> currentLevel = levels.get(level);

                // Find sibling
                int siblingIndex;
                if (leafIndex % 2 == 0) {
                    // Left node, sibling is right
                    siblingIndex = Math.min(leafIndex + 1, currentLevel.size() - 1);
                } else {
                    // Right node, sibling is left
                    siblingIndex = leafIndex - 1;
                }

                if (siblingIndex >= 0 && siblingIndex < currentLevel.size()) {
                    proof.add(currentLevel.get(siblingIndex));
                }

                // Move to parent index
                leafIndex = leafIndex / 2;
            }

            // Convert proof to JSON-like string
            String proofStr = proof.isEmpty() ? "[]" : "[\"" + String.join("\",\"", proof) + "\"]";
            proofs.add(proofStr);
        }

        return proofs;
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

    /**
     * Get current queue size.
     */
    public int getQueueSize() {
        return pendingWatermarks.size();
    }

    /**
     * Get blockchain statistics.
     */
    public Map<String, Object> getStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("queueSize", pendingWatermarks.size());
        stats.put("pendingTransactions", merkleTransactionRepository.countPendingTransactions());
        stats.put("totalBlocks", merkleBlockRepository.count());
        stats.put("totalTransactions", merkleTransactionRepository.count());
        stats.put("blockchainEnabled", blockchainEnabled);
        stats.put("batchSize", batchSize);
        stats.put("batchIntervalMs", batchIntervalMs);
        return stats;
    }

    // ===== Inner classes =====

    /**
     * Watermark record for queueing.
     */
    @lombok.Data
    @lombok.Builder
    @lombok.AllArgsConstructor
    public static class WatermarkRecord {
        private Long documentId;
        private Long userId;
        private String ipAddress;
        private WatermarkType watermarkType;
        private String leafHash;
        private String timestamp;
    }

    /**
     * Result of batch submission.
     */
    @lombok.Data
    @lombok.Builder
    public static class BatchResult {
        private boolean success;
        private boolean disabled;
        private boolean inProgress;
        private Long blockNumber;
        private String merkleRoot;
        private int transactionCount;
        private String error;

        public static BatchResult success(Long blockNumber, String merkleRoot, int count) {
            return BatchResult.builder()
                .success(true)
                .blockNumber(blockNumber)
                .merkleRoot(merkleRoot)
                .transactionCount(count)
                .build();
        }

        public static BatchResult disabled() {
            return BatchResult.builder().disabled(true).build();
        }

        public static BatchResult inProgress() {
            return BatchResult.builder().inProgress(true).build();
        }

        public static BatchResult empty() {
            return BatchResult.builder().success(true).transactionCount(0).build();
        }

        public static BatchResult error(String message) {
            return BatchResult.builder().success(false).error(message).build();
        }
    }
}
