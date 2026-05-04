package com.dlp.platform.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.web3j.crypto.Credentials;
import org.web3j.crypto.RawTransaction;
import org.web3j.crypto.TransactionEncoder;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.response.EthGetBalance;
import org.web3j.protocol.core.methods.response.EthGetTransactionCount;
import org.web3j.protocol.core.methods.response.EthGetTransactionReceipt;
import org.web3j.protocol.core.methods.response.EthSendTransaction;
import org.web3j.protocol.core.methods.response.EthTransaction;
import org.web3j.protocol.core.methods.response.TransactionReceipt;
import org.web3j.protocol.http.HttpService;
import org.web3j.utils.Numeric;

import java.math.BigInteger;
import java.math.RoundingMode;
import java.math.BigDecimal;
import java.util.Locale;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Optional blockchain anchoring service (Ethereum-compatible).
 *
 * Minimal MVP:
 * - When enabled, writes a 32-byte SHA-256 hash as the tx input data to create an immutable timestamp.
 * - Stores tx hash in SignatureRecord.blockchainTxHash.
 * - Verification checks the on-chain tx input matches the expected hash.
 */
@Service
@Slf4j
public class BlockchainService {

    @Value("${dlp.blockchain.enabled:false}")
    private boolean enabled;

    @Value("${dlp.blockchain.rpc-url:}")
    private String rpcUrl;

    /**
     * WARNING: store this in env var / secret manager, never commit.
     * This key pays gas fees on the configured network.
     */
    @Value("${dlp.blockchain.private-key:}")
    private String privateKey;

    @Value("${dlp.blockchain.chain-id:11155111}")
    private long chainId;

    @Value("${dlp.blockchain.gas-price-wei:}")
    private String gasPriceWei;

    @Value("${dlp.blockchain.gas-limit:50000}")
    private long gasLimit;

    @Value("${dlp.blockchain.anchor.max-retries:6}")
    private int anchorMaxRetries;

    @Value("${dlp.blockchain.anchor.retry-delay-ms:350}")
    private long anchorRetryDelayMs;

    public boolean isEnabled() {
        return enabled && rpcUrl != null && !rpcUrl.isBlank() && isPrivateKeyValid(privateKey);
    }

    public Map<String, Object> healthSnapshot() {
        Map<String, Object> health = new LinkedHashMap<>();
        boolean hasRpcUrl = rpcUrl != null && !rpcUrl.isBlank();
        boolean hasPrivateKey = privateKey != null && !privateKey.isBlank();
        boolean ready = isEnabled();

        health.put("enabled", enabled);
        health.put("hasRpcUrl", hasRpcUrl);
        health.put("hasPrivateKey", hasPrivateKey);
        health.put("privateKeyValid", isPrivateKeyValid(privateKey));
        health.put("ready", ready);
        health.put("configuredChainId", chainId);
        health.put("rpcUrl", maskRpcUrl(rpcUrl));

        if (isPrivateKeyValid(privateKey)) {
            try {
                Credentials credentials = Credentials.create(normalizePrivateKey(privateKey));
                health.put("address", credentials.getAddress());
            } catch (Exception ex) {
                health.put("address", "");
                health.put("credentialsError", ex.getMessage());
            }
        } else {
            health.put("address", "");
        }

        if (!ready) {
            health.put("rpcReachable", false);
            health.put("status", "NOT_READY");
            return health;
        }

        Web3j web3j = null;
        try {
            web3j = Web3j.build(new HttpService(rpcUrl));
            String clientVersion = web3j.web3ClientVersion().send().getWeb3ClientVersion();
            BigInteger actualChainId = web3j.ethChainId().send().getChainId();
            boolean chainIdMatched = actualChainId != null && actualChainId.longValue() == chainId;
            if (health.get("address") instanceof String address && !address.isBlank()) {
                EthGetBalance bal = web3j.ethGetBalance(address, DefaultBlockParameterName.LATEST).send();
                BigInteger balanceWei = bal.getBalance();
                health.put("balanceWei", balanceWei.toString());
                health.put("balanceEth", toEth(balanceWei));
            }

            health.put("rpcReachable", true);
            health.put("clientVersion", clientVersion);
            health.put("actualChainId", actualChainId != null ? actualChainId.longValue() : null);
            health.put("chainIdMatched", chainIdMatched);
            health.put("status", chainIdMatched ? "HEALTHY" : "CHAIN_ID_MISMATCH");
        } catch (Exception ex) {
            health.put("rpcReachable", false);
            health.put("status", "RPC_ERROR");
            health.put("error", ex.getMessage());
        } finally {
            if (web3j != null) {
                web3j.shutdown();
            }
        }
        return health;
    }

    /**
     * Anchor a 32-byte hash (hex string, 64 chars) to blockchain as tx input data.
     * Returns tx hash.
     */
    public String anchorSignature(String signatureHashHex) throws Exception {
        if (!isEnabled()) {
            return null;
        }
        if (signatureHashHex == null || signatureHashHex.length() != 64) {
            throw new IllegalArgumentException("signatureHashHex must be a 32-byte hex string (64 chars)");
        }

        int maxAttempts = Math.max(1, anchorMaxRetries);
        Exception lastError = null;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            Web3j web3j = null;
            try {
                web3j = Web3j.build(new HttpService(rpcUrl));
                Credentials credentials = Credentials.create(normalizePrivateKey(privateKey));
                String from = credentials.getAddress();
                String to = from;
                String data = "0x" + signatureHashHex.toLowerCase(Locale.ROOT);

                EthGetTransactionCount txCount = web3j.ethGetTransactionCount(from, DefaultBlockParameterName.PENDING).send();
                BigInteger nonce = txCount.getTransactionCount();
                BigInteger gasPrice = parseGasPriceWei(web3j);
                BigInteger gasLimitBI = BigInteger.valueOf(gasLimit);
                BigInteger txCostWei = gasPrice.multiply(gasLimitBI);
                BigInteger balanceWei = web3j.ethGetBalance(from, DefaultBlockParameterName.LATEST).send().getBalance();

                if (balanceWei.compareTo(txCostWei) < 0) {
                    throw new IllegalStateException(
                        "Insufficient funds for blockchain anchor. address=" + from +
                            ", balanceWei=" + balanceWei +
                            ", requiredWei=" + txCostWei +
                            ", balanceEth=" + toEth(balanceWei) +
                            ", requiredEth=" + toEth(txCostWei)
                    );
                }

                RawTransaction raw = RawTransaction.createTransaction(
                    nonce,
                    gasPrice,
                    gasLimitBI,
                    to,
                    BigInteger.ZERO,
                    data
                );

                byte[] signedMessage = TransactionEncoder.signMessage(raw, chainId, credentials);
                String hexValue = Numeric.toHexString(signedMessage);
                EthSendTransaction sent = web3j.ethSendRawTransaction(hexValue).send();

                if (sent.hasError()) {
                    String errorMessage = sent.getError().getMessage();
                    IllegalStateException txError = new IllegalStateException("Blockchain tx error: " + errorMessage);
                    if (isRetryableAnchorError(errorMessage) && attempt < maxAttempts) {
                        lastError = txError;
                        log.warn("Blockchain anchor attempt {}/{} failed with retryable error: {}",
                            attempt, maxAttempts, errorMessage);
                        sleepBeforeRetry(attempt);
                        continue;
                    }
                    throw txError;
                }

                String txHash = sent.getTransactionHash();
                log.info("Signature anchored to blockchain: txHash={}, from={}, attempt={}", txHash, from, attempt);
                return txHash;
            } catch (Exception e) {
                if (isRetryableAnchorError(e.getMessage()) && attempt < maxAttempts) {
                    lastError = e;
                    log.warn("Blockchain anchor attempt {}/{} failed (retryable): {}", attempt, maxAttempts, e.getMessage());
                    sleepBeforeRetry(attempt);
                    continue;
                }
                throw e;
            } finally {
                if (web3j != null) {
                    web3j.shutdown();
                }
            }
        }

        throw new IllegalStateException(
            "Blockchain anchor failed after " + maxAttempts + " attempts"
                + (lastError != null ? (": " + lastError.getMessage()) : "")
        );
    }

    /**
     * Verify that the on-chain tx input matches the expected 32-byte hash.
     */
    public boolean verifyAnchor(String txHash, String expectedHashHex) throws Exception {
        if (!enabled || rpcUrl == null || rpcUrl.isBlank()) {
            return true; // treat as non-blocking when disabled
        }
        if (txHash == null || txHash.isBlank() || expectedHashHex == null || expectedHashHex.length() != 64) {
            return false;
        }

        Web3j web3j = Web3j.build(new HttpService(rpcUrl));
        EthTransaction txResp = web3j.ethGetTransactionByHash(txHash).send();
        Optional<org.web3j.protocol.core.methods.response.Transaction> txOpt = txResp.getTransaction();
        if (txOpt.isEmpty()) {
            return false;
        }

        String input = txOpt.get().getInput();
        if (input == null) return false;

        String expectedInput = "0x" + expectedHashHex.toLowerCase();
        if (!input.equalsIgnoreCase(expectedInput)) {
            return false;
        }

        // If mined, also ensure success status when available
        EthGetTransactionReceipt receiptResp = web3j.ethGetTransactionReceipt(txHash).send();
        if (receiptResp.getTransactionReceipt().isPresent()) {
            String status = receiptResp.getTransactionReceipt().get().getStatus();
            // status can be null on some nodes; treat null as unknown (not failing)
            if (status != null && !"0x1".equals(status)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Inspect a transaction by hash on the configured chain.
     * Useful for admin diagnostics on local testnet or production RPC.
     */
    public Map<String, Object> inspectTransaction(String txHash) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("txHash", txHash);
        data.put("enabled", enabled);
        data.put("ready", isEnabled());
        data.put("rpcUrl", maskRpcUrl(rpcUrl));
        data.put("configuredChainId", chainId);

        if (txHash == null || txHash.isBlank()) {
            data.put("status", "INVALID_INPUT");
            data.put("message", "Transaction hash is required");
            return data;
        }
        if (!isEnabled()) {
            data.put("status", "NOT_READY");
            data.put("message", "Blockchain service is not ready");
            return data;
        }

        Web3j web3j = null;
        try {
            web3j = Web3j.build(new HttpService(rpcUrl));
            BigInteger actualChainId = web3j.ethChainId().send().getChainId();
            data.put("actualChainId", actualChainId != null ? actualChainId.longValue() : null);

            EthTransaction txResp = web3j.ethGetTransactionByHash(txHash).send();
            Optional<org.web3j.protocol.core.methods.response.Transaction> txOpt = txResp.getTransaction();
            if (txOpt.isEmpty()) {
                data.put("status", "NOT_FOUND");
                data.put("message", "Transaction not found on current chain");
                return data;
            }

            org.web3j.protocol.core.methods.response.Transaction tx = txOpt.get();
            data.put("found", true);
            data.put("from", tx.getFrom());
            data.put("to", tx.getTo());
            data.put("nonce", tx.getNonceRaw());
            data.put("value", tx.getValueRaw());
            data.put("gas", tx.getGasRaw());
            data.put("gasPrice", tx.getGasPriceRaw());
            data.put("blockNumber", tx.getBlockNumberRaw());
            data.put("blockHash", tx.getBlockHash());
            data.put("transactionIndex", tx.getTransactionIndexRaw());
            data.put("input", tx.getInput());

            EthGetTransactionReceipt receiptResp = web3j.ethGetTransactionReceipt(txHash).send();
            Optional<TransactionReceipt> receiptOpt = receiptResp.getTransactionReceipt();
            data.put("mined", receiptOpt.isPresent());
            if (receiptOpt.isPresent()) {
                TransactionReceipt r = receiptOpt.get();
                data.put("receiptStatus", r.getStatus());
                data.put("effectiveGasPrice", r.getEffectiveGasPrice() != null ? r.getEffectiveGasPrice().toString() : null);
                data.put("gasUsed", r.getGasUsedRaw());
                data.put("cumulativeGasUsed", r.getCumulativeGasUsedRaw());
            }

            data.put("status", "OK");
            data.put("message", "Transaction found");
            return data;
        } catch (Exception e) {
            data.put("status", "RPC_ERROR");
            data.put("message", "Failed to query transaction from RPC");
            data.put("error", e.getMessage());
            return data;
        } finally {
            if (web3j != null) {
                web3j.shutdown();
            }
        }
    }

    private BigInteger parseGasPriceWei(Web3j web3j) throws Exception {
        if (gasPriceWei != null && !gasPriceWei.isBlank()) {
            return new BigInteger(gasPriceWei.trim());
        }
        return web3j.ethGasPrice().send().getGasPrice();
    }

    private boolean isRetryableAnchorError(String message) {
        if (message == null || message.isBlank()) {
            return false;
        }
        String m = message.toLowerCase(Locale.ROOT);
        return m.contains("nonce too low")
            || m.contains("nonce has already been used")
            || m.contains("already known")
            || m.contains("replacement transaction underpriced")
            || m.contains("transaction underpriced")
            || m.contains("temporarily unavailable")
            || m.contains("timeout")
            || m.contains("connection reset")
            || m.contains("connection refused")
            || m.contains("failed to connect");
    }

    private void sleepBeforeRetry(int attempt) {
        long delay = Math.max(50L, anchorRetryDelayMs) * attempt;
        try {
            Thread.sleep(delay);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Blockchain anchor retry interrupted", ie);
        }
    }

    private String maskRpcUrl(String value) {
        if (value == null || value.isBlank()) return "";
        int protocolIdx = value.indexOf("://");
        if (protocolIdx < 0) return "****";
        int pathIdx = value.indexOf('/', protocolIdx + 3);
        if (pathIdx < 0) return value;
        String base = value.substring(0, pathIdx + 1);
        String tail = value.substring(pathIdx + 1);
        if (tail.length() <= 6) return base + "****";
        return base + "****" + tail.substring(Math.max(0, tail.length() - 4));
    }

    private boolean isPrivateKeyValid(String key) {
        if (key == null || key.isBlank()) return false;
        String normalized = key.trim();
        if (normalized.startsWith("0x") || normalized.startsWith("0X")) {
            normalized = normalized.substring(2);
        }
        return normalized.matches("^[0-9a-fA-F]{64}$");
    }

    private String normalizePrivateKey(String key) {
        if (!isPrivateKeyValid(key)) {
            throw new IllegalArgumentException("Invalid blockchain private key format. Expected 64 hex chars (optionally prefixed with 0x).");
        }
        String normalized = key.trim();
        if (normalized.startsWith("0x") || normalized.startsWith("0X")) {
            normalized = normalized.substring(2);
        }
        return normalized;
    }

    private String toEth(BigInteger wei) {
        return new BigDecimal(wei)
                .divide(new BigDecimal("1000000000000000000"), 8, RoundingMode.HALF_UP)
                .toPlainString();
    }
}


