package com.dlp.platform.service.document;

import com.dlp.platform.dto.document.ClassificationResult;
import com.dlp.platform.dto.document.DocumentMetadata;
import com.dlp.platform.dto.document.DocumentUploadRequest;
import com.dlp.platform.dto.document.ResolveUploadClassificationRequest;
import com.dlp.platform.dto.document.RuleDetectionResult;
import com.dlp.platform.dto.document.UploadJobResponse;
import com.dlp.platform.entity.*;
import com.dlp.platform.repository.*;
import com.dlp.platform.service.classification.ClassificationTuningService;
import com.dlp.platform.service.classification.LLMClassificationService;
import com.dlp.platform.service.key.KeyManagementService;
import com.dlp.platform.service.signature.SignatureService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Set;

@Service
@Slf4j
@RequiredArgsConstructor
public class UploadJobService {

    private final UploadJobRepository uploadJobRepository;
    private final DocumentRepository documentRepository;
    private final FileStorageService fileStorageService;
    private final LLMClassificationService llmClassificationService;
    private final DocumentService documentService;
    private final TextExtractionService textExtractionService;
    private final PIIDetectionService piiDetectionService;
    private final SignatureService signatureService;
    private final WatermarkFingerprintService watermarkFingerprintService;
    private final DocumentEncryptionService documentEncryptionService;
    private final MetadataWatermarkService metadataWatermarkService;
    private final ContentFingerprintService contentFingerprintService;
    private final ClassificationTuningService classificationTuningService;
    private final KeyManagementService keyManagementService;
    private final BlindWatermarkService blindWatermarkService;

    @Value("${security.virus-scan.enabled:true}")
    private boolean virusScanEnabled;

    @Value("${security.virus-scan.clamav.enabled:false}")
    private boolean clamAvEnabled;

    @Value("${security.virus-scan.clamav.host:localhost}")
    private String clamAvHost;

    @Value("${security.virus-scan.clamav.port:3310}")
    private int clamAvPort;

    @Value("${security.virus-scan.clamav.timeout-ms:10000}")
    private int clamAvTimeoutMs;

    /**
     * Create upload job and start async processing
     */
    @Transactional
    public UploadJobResponse createUploadJob(MultipartFile file, DocumentUploadRequest request,
                                            User user, String ipAddress) throws IOException, NoSuchAlgorithmException {
        log.info("Creating upload job for file: {} by user: {}", file.getOriginalFilename(), user.getAccountId());

        if (keyManagementService.isEnabled() &&
            (user == null || user.getId() == null || !keyManagementService.hasKey(user.getId()) || !keyManagementService.isKeyActive(user.getId()))) {
            throw new IllegalStateException("Encryption key setup is required before upload");
        }

        // Store file
        String filePath = fileStorageService.storeFile(file, request.getDepartment());
        String contentHash = fileStorageService.calculateFileHash(filePath);

        // Check for duplicate (content hash may not be unique, so just log a warning if any exist)
        java.util.List<Document> duplicates = documentRepository.findByContentHash(contentHash);
        if (!duplicates.isEmpty()) {
            log.warn("Duplicate file detected by content hash {}. Example existing document ID: {}, name: {}",
                    contentHash, duplicates.get(0).getId(), duplicates.get(0).getName());
        }

        String effectiveDocumentName = buildAutoDocumentName(user);

        // Create document entity
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || originalFilename.isEmpty()) {
            originalFilename = request.getName() + ".pdf"; // Fallback if filename is missing
        }
        
        Document document = Document.builder()
            .name(effectiveDocumentName)
            .description(request.getDescription())
            .templateType(request.getTemplateType())
            .templateDataJson(request.getTemplateDataJson())
            .owner(user)
            .department(request.getDepartment())
            .classificationLevel(request.getClassificationLevel() != null ?
                Document.ClassificationLevel.valueOf(request.getClassificationLevel()) :
                Document.ClassificationLevel.INTERNAL) // Default
            .filePath(filePath)
            .fileName(originalFilename)
            .originalFilename(originalFilename) // Set originalFilename field
            .fileType(file.getContentType())
            .fileSize(file.getSize())
            .contentHash(contentHash)
            .status(Document.DocumentStatus.PROCESSING)
            .expirationDate(request.getExpirationDate())
            .requiresReview(false)
            .build();

        // Set tags if provided
        if (request.getTags() != null && !request.getTags().isEmpty()) {
            Set<Tag> tags = documentService.getOrCreateTags(request.getTags());
            document.setTags(tags);
        }

        Document savedDocument = documentRepository.save(document);

        // Create upload job
        UploadJob job = UploadJob.builder()
            .user(user)
            .document(savedDocument)
            .status(UploadJob.JobStatus.PENDING)
            .currentStep(UploadJob.ProcessingStep.UPLOADING)
            .progress(0)
            .build();

        UploadJob savedJob = uploadJobRepository.save(job);

        // Auto-sign immediately on upload (as soon as the raw file is stored and the Document exists).
        // This ensures signatures are created regardless of whether LLM classification matches the user's selection.
        try {
            if (savedDocument.getId() != null && user != null && user.getId() != null) {
                SignatureRecord sig = signatureService.autoSignIfNeeded(
                    savedDocument.getId(),
                    contentHash,
                    user.getId(),
                    ipAddress != null ? ipAddress : "SYSTEM",
                    "SYSTEM",
                    "UPLOADER"
                );
                if (sig != null) {
                    log.info("Auto-signed on upload create: documentId={}, userId={}, signatureId={}",
                        savedDocument.getId(), user.getId(), sig.getId());
                }
            }
        } catch (Exception e) {
            throw new IllegalStateException("Auto-sign on upload create failed", e);
        }

        // Start async processing
        processUploadAsync(savedJob.getId());

        log.info("Upload job created with ID: {}", savedJob.getId());
        return UploadJobResponse.from(savedJob);
    }

    private String buildAutoDocumentName(User user) {
        String timePart = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        String ownerRaw = user != null && user.getFullName() != null && !user.getFullName().isBlank()
            ? user.getFullName()
            : (user != null && user.getAccountId() != null ? user.getAccountId() : "unknown");
        String ownerPart = ownerRaw.replaceAll("[^a-zA-Z0-9]", "_");
        return timePart + "_" + ownerPart;
    }

    /**
     * Process upload job asynchronously
     */
    @Async
    @Transactional
    public void processUploadAsync(Long jobId) {
        log.info("Starting async processing for job: {}", jobId);

        UploadJob job = uploadJobRepository.findById(jobId)
            .orElseThrow(() -> new RuntimeException("Job not found"));

        try {
            // Update status to PROCESSING
            job.setStatus(UploadJob.JobStatus.PROCESSING);
            job.setCurrentStep(UploadJob.ProcessingStep.UPLOADING);
            job.setProgress(10);
            uploadJobRepository.save(job);

            // Step 1: Virus scanning (placeholder)
            job.setCurrentStep(UploadJob.ProcessingStep.VIRUS_SCANNING);
            job.setProgress(20);
            uploadJobRepository.save(job);
            virusScan(job.getDocument());

            // Step 2: Text extraction (must run before watermarking for PDF,
            // otherwise rasterized watermark pipeline can remove searchable text layer)
            job.setCurrentStep(UploadJob.ProcessingStep.TEXT_EXTRACTION);
            job.setProgress(25);
            uploadJobRepository.save(job);
            String extractedText;
            try {
                extractedText = extractText(job.getDocument());
            } catch (IOException e) {
                if (isEncryptedPdfExtractionError(e)) {
                    String reason = "Upload failed: encrypted PDF cannot be decrypted for classification";
                    log.warn("Text extraction failed for encrypted PDF document {}. Marking upload job as FAILED.",
                        job.getDocument().getId());
                    log.debug("Encrypted PDF extraction technical detail for document {}: {}",
                        job.getDocument().getId(), e.getMessage(), e);
                    finalizeFailedExtraction(job, reason);
                    return;
                }

                // Non-encrypted extraction issue: complete upload with warning and keep user-selected level.
                String reason = "Text extraction unavailable (non-extractable document); kept user-selected classification";
                log.warn("Text extraction unavailable for document {}. Completing upload without LLM. Reason: {}",
                    job.getDocument().getId(), reason);
                log.debug("Text extraction technical detail for document {}: {}",
                    job.getDocument().getId(), e.getMessage(), e);
                finalizeWithoutExtractedText(job, reason);
                return;
            }

            if (extractedText == null || extractedText.isBlank()) {
                String reason = "No extractable text found in document; kept user-selected classification";
                log.info("No extracted text for document {}. Completing upload without LLM.",
                    job.getDocument().getId());
                finalizeWithoutExtractedText(job, reason);
                return;
            }

            // Step 2.5: PII Detection
            job.setProgress(45);
            uploadJobRepository.save(job);
            RuleDetectionResult ruleResults = piiDetectionService.detectPII(extractedText);
            log.info("PII detection: {}", piiDetectionService.getDetectionSummary(ruleResults));

            // Step 3: LLM Classification
            job.setCurrentStep(UploadJob.ProcessingStep.LLM_CLASSIFICATION);
            job.setProgress(60);
            uploadJobRepository.save(job);

            ClassificationResult classificationResult;
            try {
                // Build metadata for classification
                DocumentMetadata metadata = DocumentMetadata.builder()
                    .fileName(job.getDocument().getFileName())
                    .department(job.getDocument().getDepartment())
                    .ownerName(job.getDocument().getOwner().getFullName())
                    .fileSize(job.getDocument().getFileSize())
                    .selectedClassificationLevel(job.getDocument().getClassificationLevel())
                    .userDescription(job.getDocument().getDescription())
                    .templateType(job.getDocument().getTemplateType())
                    .templateDataJson(job.getDocument().getTemplateDataJson())
                    .build();

                try {
                    var llmHealth = llmClassificationService.healthSnapshot();
                    log.info("LLM classification mode for upload job {}: enabled={}, authMode={}, endpointMode={}, endpointId={}, model={}",
                        job.getId(),
                        llmHealth.get("llmEnabled"),
                        llmHealth.get("authMode"),
                        llmHealth.get("endpointMode"),
                        llmHealth.get("endpointId"),
                        llmHealth.get("model"));
                } catch (Exception e) {
                    log.warn("Failed to obtain LLM health snapshot before classification for job {}: {}",
                        job.getId(), e.getMessage());
                }

                classificationResult = llmClassificationService.classifyDocument(
                    extractedText,
                    ruleResults,
                    metadata
                );
                // Store prompts for potential tuning dataset when reviewer corrects the level
                try {
                    var prompts = llmClassificationService.buildPromptsForTuning(extractedText, ruleResults, metadata);
                    job.setSystemPromptSnapshot(prompts.get("systemPrompt"));
                    job.setUserPromptSnapshot(prompts.get("userPrompt"));
                } catch (Exception e) {
                    log.warn("Could not store prompt snapshots for tuning: {}", e.getMessage());
                }
                log.info("LLM classification output for document {}: level={}, confidence={}, tags={}, reason={}, sensitive={} ",
                    job.getDocument().getId(),
                    classificationResult.getClassificationLevel(),
                    classificationResult.getConfidence(),
                    classificationResult.getSuggestedTags(),
                    classificationResult.getReason(),
                    classificationResult.getDetectedSensitiveInfo());
            } catch (Exception e) {
                // Strict mode: if LLM is unavailable, fail the upload explicitly.
                String llmReason = "Upload failed: LLM classification unavailable";
                log.warn("LLM classification failed. Marking upload job as FAILED. Document: {}",
                    job.getDocument().getId(), e);
                finalizeFailedLlmClassification(job, llmReason, e);
                return;
            }

            // Step 4: Apply classification results
            job.setCurrentStep(UploadJob.ProcessingStep.POLICY_APPLICATION);
            job.setProgress(75);
            uploadJobRepository.save(job);
            applyClassification(job.getDocument(), classificationResult);

            // Apply watermark layers after classification decision is made.
            // This keeps classification quality while still enforcing fail-closed watermarking.
            // NOTE: Do not change currentStep here to avoid violating legacy DB check constraint.
            job.setProgress(85);
            uploadJobRepository.save(job);
            applyWatermarkingLayers(job.getDocument(), job.getUser());

            // Encrypt final stored file after all processing steps completed.
            // Keep current_step at last schema-supported value to satisfy DB check constraint.
            job.setProgress(92);
            uploadJobRepository.save(job);
            encryptDocumentAtRest(job.getDocument());

            // Update job status
            job.setSuggestedClassification(classificationResult.getClassificationLevel());
            job.setClassificationConfidence(classificationResult.getConfidence());
            job.setClassificationReason(classificationResult.getReason());

            boolean mismatch = classificationResult.getClassificationLevel() != null
                && job.getDocument().getClassificationLevel() != null
                && classificationResult.getClassificationLevel() != job.getDocument().getClassificationLevel();

            // For user/LLM mismatch, keep job as COMPLETED and wait for user decision on result page.
            // REVIEW_REQUIRED is only set after user explicitly keeps own level and reports mismatch.
            // Low confidence alone should not push the document into pending review queue.
            if (mismatch) {
                job.setStatus(UploadJob.JobStatus.COMPLETED);
                job.getDocument().setStatus(Document.DocumentStatus.CLASSIFIED);
                job.getDocument().setRequiresReview(false);
            } else {
                job.setStatus(UploadJob.JobStatus.COMPLETED);
                job.getDocument().setStatus(Document.DocumentStatus.CLASSIFIED);
                job.getDocument().setRequiresReview(false);
            }

            job.setProgress(100);
            job.setCompletedAt(LocalDateTime.now());
            uploadJobRepository.save(job);
            documentRepository.save(job.getDocument());

            // Auto-sign only when classification is finalized (no manual review required)
            tryAutoSignAfterUpload(job);

            log.info("Upload job {} completed successfully", jobId);

        } catch (Exception e) {
            log.error("Error processing upload job: {}", jobId, e);
            job.setStatus(UploadJob.JobStatus.FAILED);
            job.setErrorMessage(e.getMessage());
            job.setCompletedAt(LocalDateTime.now());
            uploadJobRepository.save(job);

            if (job.getDocument() != null) {
                job.getDocument().setStatus(Document.DocumentStatus.FAILED);
                documentRepository.save(job.getDocument());
            }
        }
    }

    private void tryAutoSignAfterUpload(UploadJob job) {
        try {
            if (job == null || job.getUser() == null || job.getDocument() == null) return;
            // Only auto-sign when job is fully completed AND document does not require review
            if (job.getStatus() != UploadJob.JobStatus.COMPLETED) return;
            if (Boolean.TRUE.equals(job.getDocument().getRequiresReview())) return;

            Long documentId = job.getDocument().getId();
            Long userId = job.getUser().getId();

            // Compute canonical hash from raw stored bytes
            String hash = documentService.getDocumentContentHash(documentId, job.getUser(), "SYSTEM");

            SignatureRecord sig = signatureService.autoSignIfNeeded(
                documentId,
                hash,
                userId,
                "SYSTEM",
                "SYSTEM",
                "UPLOADER"
            );

            if (sig != null) {
                log.info("Auto-signed document {} for user {} (signatureId={})", documentId, userId, sig.getId());
            } else {
                log.debug("Auto-sign skipped (already signed) for document {} user {}", documentId, userId);
            }
        } catch (Exception e) {
            throw new RuntimeException("Auto-sign after upload failed", e);
        }
    }

    private void finalizeWithoutExtractedText(UploadJob job, String reason) {
        Document document = job.getDocument();
        if (document == null) {
            throw new IllegalStateException("Job has no document");
        }

        // Even if text cannot be extracted, watermarking and encryption must still be applied
        // in a fail-closed manner, but the document should be marked as pending manual review
        // instead of being treated as fully classified.
        job.setProgress(85);
        uploadJobRepository.save(job);
        applyWatermarkingLayers(document, job.getUser());
        job.setProgress(92);
        uploadJobRepository.save(job);
        encryptDocumentAtRest(document);

        job.setSuggestedClassification(document.getClassificationLevel());
        job.setClassificationConfidence(null);
        job.setClassificationReason(reason);
        // Completed-with-warning path: processing chain finished, but manual reviewer decision is required.
        job.setErrorMessage(null);
        job.setStatus(UploadJob.JobStatus.COMPLETED);
        job.setProgress(100);
        job.setCompletedAt(LocalDateTime.now());

        document.setRequiresReview(true);
        document.setStatus(Document.DocumentStatus.REVIEW_REQUIRED);

        uploadJobRepository.save(job);
        documentRepository.save(document);

        // When the document is pending review, auto-sign must be skipped;
        // tryAutoSignAfterUpload checks requiresReview and will no-op in that case.
        tryAutoSignAfterUpload(job);
    }

    private boolean isEncryptedPdfExtractionError(IOException e) {
        Throwable current = e;
        while (current != null) {
            String msg = current.getMessage();
            if (msg != null) {
                String lower = msg.toLowerCase();
                if (lower.contains("cannot decrypt")
                        || lower.contains("encrypted")
                        || lower.contains("password")) {
                    return true;
                }
            }
            current = current.getCause();
        }
        return false;
    }

    private void finalizeFailedExtraction(UploadJob job, String reason) {
        Document document = job.getDocument();
        if (document == null) {
            throw new IllegalStateException("Job has no document");
        }

        job.setSuggestedClassification(null);
        job.setClassificationConfidence(null);
        job.setClassificationReason(reason);
        job.setErrorMessage(reason);
        job.setStatus(UploadJob.JobStatus.FAILED);
        job.setProgress(100);
        job.setCompletedAt(LocalDateTime.now());

        document.setRequiresReview(false);
        document.setStatus(Document.DocumentStatus.FAILED);

        uploadJobRepository.save(job);
        documentRepository.save(document);
    }

    private void finalizeFailedLlmClassification(UploadJob job, String reason, Exception cause) {
        Document document = job.getDocument();
        if (document == null) {
            throw new IllegalStateException("Job has no document");
        }

        String detail = null;
        if (cause != null) {
            detail = cause.getMessage();
            Throwable root = cause.getCause();
            while (root != null) {
                if (root.getMessage() != null && !root.getMessage().isBlank()) {
                    detail = root.getMessage();
                }
                root = root.getCause();
            }
        }

        job.setSuggestedClassification(null);
        job.setClassificationConfidence(null);
        job.setClassificationReason(reason);
        job.setErrorMessage(detail != null && !detail.isBlank()
            ? reason + ": " + detail
            : reason);
        job.setStatus(UploadJob.JobStatus.FAILED);
        job.setProgress(100);
        job.setCompletedAt(LocalDateTime.now());

        // Mark document as hidden so it does not appear in any document list.
        // The failure reason is still visible via job-polling (UploadJobResponse).
        document.setRequiresReview(false);
        document.setStatus(Document.DocumentStatus.FAILED);
        document.setHidden(true);

        // Delete the physical file since the upload is rejected.
        // This prevents orphaned files on disk for failed LLM classification.
        String filePath = document.getFilePath();
        if (filePath != null && !filePath.isBlank()) {
            try {
                fileStorageService.deleteFile(filePath);
                log.info("Deleted orphan file after failed LLM classification: {}", filePath);
            } catch (IOException e) {
                log.warn("Failed to delete orphan file (will remain on disk): {}", filePath, e);
            }
        }

        uploadJobRepository.save(job);
        documentRepository.save(document);
    }

    private void encryptDocumentAtRest(Document document) {
        try {
            documentEncryptionService.encryptDocumentAtRest(document);
        } catch (Exception e) {
            throw new RuntimeException("Failed to encrypt document at rest", e);
        }
    }

    /**
     * Get upload job status
     */
    @Transactional(readOnly = true)
    public UploadJobResponse getJobStatus(Long jobId) {
        UploadJob job = uploadJobRepository.findById(jobId)
            .orElseThrow(() -> new RuntimeException("Job not found"));
        return UploadJobResponse.from(job);
    }

    @Transactional(readOnly = true)
    public UploadJobResponse getJobStatus(Long jobId, User currentUser) {
        UploadJob job = uploadJobRepository.findById(jobId)
            .orElseThrow(() -> new RuntimeException("Job not found"));

        if (currentUser == null) {
            throw new org.springframework.security.access.AccessDeniedException("User not authenticated");
        }

        boolean isOwner = job.getUser() != null
            && job.getUser().getId() != null
            && job.getUser().getId().equals(currentUser.getId());

        boolean isAdminOrReviewer = currentUser.getRoles() != null && currentUser.getRoles().stream()
            .anyMatch(r -> {
                if (r == null) return false;
                String rr = r.trim().toUpperCase();
                return rr.equals("ADMIN")
                    || rr.equals("ROLE_ADMIN")
                    || rr.equals("REVIEWER")
                    || rr.equals("ROLE_REVIEWER");
            });

        if (!isOwner && !isAdminOrReviewer) {
            throw new org.springframework.security.access.AccessDeniedException("Not allowed to view this upload job");
        }

        return UploadJobResponse.from(job);
    }

    private void virusScan(Document document) throws InterruptedException {
        log.info("Performing virus scan for document: {}", document.getId());
        if (!virusScanEnabled) {
            throw new IllegalStateException("Virus scan is disabled by configuration");
        }
        try {
            byte[] content = fileStorageService.readFile(document.getFilePath());
            String fileName = document.getFileName() == null ? "" : document.getFileName();
            if (containsEicar(content)) {
                throw new SecurityException("Virus detected: EICAR signature");
            }
            if (isExecutableDisguised(document.getFileType(), fileName, content)) {
                throw new SecurityException("Virus scan blocked suspicious executable content");
            }
            if (clamAvEnabled) {
                String clamResult = scanWithClamAv(content);
                if (clamResult != null && clamResult.contains("FOUND")) {
                    throw new SecurityException("Virus detected by ClamAV: " + clamResult);
                }
            }
        } catch (SecurityException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Virus scan failed", e);
        }
        log.info("Virus scan completed for document: {}", document.getId());
    }

    /**
     * Extract text from document using TextExtractionService
     */
    private String extractText(Document document) throws IOException {
        log.info("Extracting text from document: {}", document.getId());

        byte[] fileContent = fileStorageService.readFile(document.getFilePath());
        String extractedText = textExtractionService.extractText(
            fileContent,
            document.getFileType(),
            document.getFileName()
        );

        log.info("Text extraction completed for document: {} ({} characters)",
            document.getId(), extractedText.length());

        return extractedText;
    }

    /**
     * Apply classification results to document
     */
    private void applyClassification(Document document, ClassificationResult result) {
        log.info("Applying classification to document: {}", document.getId());
        log.debug("Final classification result: level={}, confidence={}, reason={}, tags={}, sensitive={}",
            result.getClassificationLevel(),
            result.getConfidence(),
            result.getReason(),
            result.getSuggestedTags(),
            result.getDetectedSensitiveInfo());

        // IMPORTANT:
        // - User-selected classification is stored on the Document at upload time.
        // - LLM classification is used to validate/compare; if mismatch requires review, we DO NOT overwrite user selection here.
        boolean mismatch = result.getClassificationLevel() != null
            && document.getClassificationLevel() != null
            && result.getClassificationLevel() != document.getClassificationLevel();

        // If user-selected level differs from LLM suggestion, await user choice on upload result page.
        // requiresReview stays false until user explicitly clicks "Keep my level and report (send for review)".
        if (mismatch) {
            log.info("User-selected level {} differs from LLM suggestion {} for document {}. Awaiting user resolution.",
                document.getClassificationLevel(), result.getClassificationLevel(), document.getId());
            document.setRequiresReview(false);
            // Keep user's selected level; don't overwrite with LLM suggestion
        } else {
            // If no mismatch, use LLM classification result
            document.setClassificationLevel(result.getClassificationLevel());
            document.setRequiresReview(result.isRequiresManualReview());
        }
        
        document.setClassificationConfidence(result.getConfidence());
        document.setClassificationReason(result.getReason());

        // Add suggested tags
        if (result.getSuggestedTags() != null && !result.getSuggestedTags().isEmpty()) {
            Set<Tag> existingTags = document.getTags();
            Set<Tag> newTags = documentService.getOrCreateTags(new java.util.HashSet<>(result.getSuggestedTags()));
            existingTags.addAll(newTags);
            document.setTags(existingTags);
        }

        documentRepository.save(document);
        log.info("Classification applied to document: {}", document.getId());
    }

    /**
     * Resolve an upload classification mismatch by selecting the final level.
     * This ends the upload job and (optionally) flags the document for team review.
     */
    @Transactional
    public UploadJobResponse resolveUploadClassification(Long jobId, User currentUser, ResolveUploadClassificationRequest request) {
        UploadJob job = uploadJobRepository.findById(jobId)
            .orElseThrow(() -> new RuntimeException("Job not found"));

        if (job.getDocument() == null) {
            throw new RuntimeException("Job has no document");
        }

        // Only uploader, ADMIN, or REVIEWER can resolve
        boolean isOwner = job.getUser() != null && currentUser != null && job.getUser().getId().equals(currentUser.getId());
        boolean isAdmin = currentUser != null && currentUser.getRoles() != null && currentUser.getRoles().stream()
            .anyMatch(r -> {
                if (r == null) return false;
                String rr = r.trim().toUpperCase();
                return rr.equals("ADMIN") || rr.equals("ROLE_ADMIN");
            });
        boolean isReviewer = currentUser != null && currentUser.getRoles() != null && currentUser.getRoles().stream()
            .anyMatch(r -> {
                if (r == null) return false;
                String rr = r.trim().toUpperCase();
                return rr.equals("REVIEWER") || rr.equals("ROLE_REVIEWER");
            });

        if (!isOwner && !isAdmin && !isReviewer) {
            throw new org.springframework.security.access.AccessDeniedException("Not allowed to resolve this upload");
        }

        boolean mismatchPendingDecision = job.getStatus() == UploadJob.JobStatus.COMPLETED
            && job.getSuggestedClassification() != null
            && job.getDocument().getClassificationLevel() != null
            && job.getSuggestedClassification() != job.getDocument().getClassificationLevel()
            && !Boolean.TRUE.equals(job.getDocument().getRequiresReview())
            && (job.getClassificationReason() == null || !job.getClassificationReason().contains("User final label="));
        if (job.getStatus() != UploadJob.JobStatus.REVIEW_REQUIRED && !mismatchPendingDecision) {
            throw new IllegalStateException("Job is not in resolvable classification state");
        }

        Document.ClassificationLevel finalLevel = Document.ClassificationLevel.valueOf(
            request.getFinalClassificationLevel().trim().toUpperCase()
        );

        boolean report = request.getReportLlmMistake() != null && request.getReportLlmMistake();

        Document document = job.getDocument();
        document.setClassificationLevel(finalLevel);

        // Pending review is required only when final level differs from LLM suggestion.
        // If final level equals suggestion, treat as accepted and do not send to review queue.
        boolean differsFromLlm = job.getSuggestedClassification() != null && job.getSuggestedClassification() != finalLevel;
        boolean keepForTeamReview = differsFromLlm;

        document.setRequiresReview(keepForTeamReview);
        document.setStatus(keepForTeamReview ? Document.DocumentStatus.REVIEW_REQUIRED : Document.DocumentStatus.CLASSIFIED);

        String comment = request.getComment() != null ? request.getComment().trim() : "";
        String baseReason = (job.getClassificationReason() != null ? job.getClassificationReason() : "");
        // If user/LLM now agree, remove stale mismatch/manual-review marker from old reason text.
        if (!differsFromLlm) {
            baseReason = stripMismatchMarker(baseReason);
        }
        String resolutionPrefix = differsFromLlm
            ? "User kept own level"
            : "User accepted final level";
        String appended = " | " + resolutionPrefix
            + ": User final label=" + finalLevel
            + (job.getSuggestedClassification() != null ? (", LLM=" + job.getSuggestedClassification()) : "")
            + (report ? ", user_reported_llm_mistake=true" : "")
            + (!comment.isBlank() ? (", comment=" + comment) : "");

        job.setClassificationReason((baseReason + appended).trim());

        // Mark job completed (resolution step finished)
        job.setStatus(UploadJob.JobStatus.COMPLETED);
        job.setProgress(100);
        job.setCompletedAt(java.time.LocalDateTime.now());

        uploadJobRepository.save(job);
        documentRepository.save(document);

        // When user selects the final level, two cases are used to train:
        // - differsFromLlm = true  ??LLM mistake, corrected
        // - differsFromLlm = false ??LLM correct, accepted by user
        try {
            if (differsFromLlm) {
                classificationTuningService.recordCorrection(
                        document.getId(),
                        job.getId(),
                        finalLevel.name()
                );
            } else {
                classificationTuningService.recordAcceptedSuggestion(
                        document.getId(),
                        job.getId(),
                        finalLevel.name()
                );
            }
        } catch (Exception e) {
            log.warn("Failed to record classification tuning example: {}", e.getMessage());
        }

        // Auto-sign ONLY if user and LLM reached consensus (no team review needed).
        if (!keepForTeamReview) {
            try {
                String hash = documentService.getDocumentContentHash(document.getId(), currentUser, "SYSTEM");
                SignatureRecord sig = signatureService.autoSignIfNeeded(
                    document.getId(),
                    hash,
                    currentUser.getId(),
                    "SYSTEM",
                    "SYSTEM",
                    "UPLOADER"
                );
                if (sig != null) {
                    log.info("Auto-signed after resolve: documentId={}, userId={}, signatureId={}",
                        document.getId(), currentUser.getId(), sig.getId());
                }
            } catch (Exception e) {
                throw new RuntimeException("Auto-sign after resolve failed", e);
            }
        }

        return UploadJobResponse.from(job);
    }

    /**
     * Get user's active jobs
     */
    @Transactional(readOnly = true)
    public java.util.List<UploadJobResponse> getUserActiveJobs(User user) {
        return uploadJobRepository.findActiveJobsByUser(user).stream()
            .map(UploadJobResponse::from)
            .collect(java.util.stream.Collectors.toList());
    }

    /**
     * Get active / recent jobs for admin dashboard queue.
     * For simplicity we return all jobs with status PENDING or PROCESSING.
     */
    @Transactional(readOnly = true)
    public java.util.List<UploadJobResponse> getActiveJobs() {
        java.util.List<UploadJobResponse> result = new java.util.ArrayList<>();

        // Pending jobs
        uploadJobRepository.findByStatus(UploadJob.JobStatus.PENDING)
                .forEach(job -> result.add(UploadJobResponse.from(job)));

        // Processing jobs
        uploadJobRepository.findByStatus(UploadJob.JobStatus.PROCESSING)
                .forEach(job -> result.add(UploadJobResponse.from(job)));

        return result;
    }

    /**
     * Fourth Layer: Automatic Upload Processing
     * Embeds blind/metadata/fingerprint layers. Visible UID watermark is NOT applied here;
     * it is applied at view/download time so viewer identity, IP, and time are current.
     *
     * Layer order:
     * 1. Blind Watermark (s2c BPSK) - images only, when available
     * 2. Metadata Watermark (PDFs)
     * 3. Content fingerprints / honeytokens
     */
    private void applyWatermarkingLayers(Document document, User user) {
        try {
            log.info("Applying watermarking layers to document: {}", document.getId());
            
            // Read original file content
            byte[] content = fileStorageService.readFile(document.getFilePath());
            String fileType = document.getFileType();
            String deviceId = "SYSTEM"; // In production, get from user session/device fingerprint

            // Apply Blind Watermark first (invisible BPSK pattern)
            // This is independent of visible watermark and done on images
            if (blindWatermarkService.isEnabled() && blindWatermarkService.isAvailable()) {
                if (fileType != null && fileType.startsWith("image/")) {
                    try {
                        byte[] blindWatermarked = blindWatermarkService.embedBlindWatermark(content, user, document.getId());
                        if (blindWatermarked != null && blindWatermarked != content) {
                            content = blindWatermarked;
                            log.info("Blind watermark (s2c BPSK) embedded successfully for document: {}", document.getId());
                            
                            // Record fingerprint for traceback
                            BlindWatermarkService.ExtractionResult embedResult = 
                                blindWatermarkService.extractBlindWatermark(content, document.getId());
                            if (embedResult.isDetected()) {
                                int wmId = embedResult.computeWmId();
                                watermarkFingerprintService.recordStegaStampFingerprint(
                                    String.valueOf(wmId),
                                    String.format("EMP-%d-T%d", embedResult.getUserId(), embedResult.getTimeSlot()),
                                    user,
                                    deviceId,
                                    document.getId()
                                );
                            }
                        }
                    } catch (Exception e) {
                        log.warn("Failed to embed blind watermark for document {}, continuing with visible watermark only: {}",
                            document.getId(), e.getMessage());
                    }
                }
            } else {
                log.debug("Blind watermark service not available or disabled, skipping for document: {}", document.getId());
            }

            // Visible UID watermark is applied in DocumentService on preview/download only.

            // Apply Metadata/GUID watermarking (for PDFs)
            if (fileType != null && fileType.equals("application/pdf")) {
                content = metadataWatermarkService.embedMetadataWatermark(content, user, document.getId());
                log.debug("Metadata watermark applied to PDF");
            }
            
            // Apply Third Layer: Content fingerprints/honeytokens (for text-based content)
            content = contentFingerprintService.insertContentFingerprints(content, user, document.getId());
            log.debug("Content fingerprints inserted");
            
            // Save watermarked content back to file
            String newFilePath = fileStorageService.storeFileFromBytes(
                content, 
                document.getDepartment(), 
                document.getFileName()
            );
            
            // Update document with new file path and recalculate hash
            document.setFilePath(newFilePath);
            String newHash = fileStorageService.calculateFileHash(newFilePath);
            document.setContentHash(newHash);
            
            documentRepository.save(document);
            log.info("Watermarking layers applied successfully to document: {}", document.getId());
            
        } catch (Exception e) {
            String detail = e.getMessage();
            Throwable root = e.getCause();
            while (root != null) {
                if (root.getMessage() != null && !root.getMessage().isBlank()) {
                    detail = root.getMessage();
                }
                root = root.getCause();
            }
            throw new RuntimeException(
                detail != null && !detail.isBlank()
                    ? "Failed to apply watermarking layers: " + detail
                    : "Failed to apply watermarking layers",
                e
            );
        }
    }

    private boolean containsEicar(byte[] content) {
        String s = new String(content, StandardCharsets.US_ASCII);
        return s.contains("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*");
    }

    private boolean isExecutableDisguised(String mimeType, String fileName, byte[] content) {
        String lowerName = fileName == null ? "" : fileName.toLowerCase();
        boolean nameLooksDocument = lowerName.endsWith(".pdf") || lowerName.endsWith(".doc") || lowerName.endsWith(".docx")
            || lowerName.endsWith(".xls") || lowerName.endsWith(".xlsx") || lowerName.endsWith(".ppt") || lowerName.endsWith(".pptx")
            || lowerName.endsWith(".txt") || lowerName.endsWith(".png") || lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg");
        if (!nameLooksDocument) {
            return false;
        }
        boolean mz = content != null && content.length > 2 && content[0] == 'M' && content[1] == 'Z';
        boolean elf = content != null && content.length > 4 && content[0] == 0x7F && content[1] == 'E' && content[2] == 'L' && content[3] == 'F';
        boolean peMimeMismatch = mz && mimeType != null && !mimeType.equalsIgnoreCase("application/x-msdownload");
        return elf || peMimeMismatch;
    }

    private String scanWithClamAv(byte[] content) throws IOException {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(clamAvHost, clamAvPort), clamAvTimeoutMs);
            socket.setSoTimeout(clamAvTimeoutMs);
            OutputStream out = socket.getOutputStream();
            InputStream in = socket.getInputStream();
            out.write("zINSTREAM\0".getBytes(StandardCharsets.US_ASCII));
            int offset = 0;
            int chunkSize = 2048;
            while (offset < content.length) {
                int len = Math.min(chunkSize, content.length - offset);
                out.write(ByteBuffer.allocate(4).putInt(len).array());
                out.write(content, offset, len);
                offset += len;
            }
            out.write(new byte[]{0, 0, 0, 0});
            out.flush();
            byte[] responseBytes = in.readAllBytes();
            return new String(responseBytes, StandardCharsets.UTF_8).trim();
        }
    }

    private String stripMismatchMarker(String reason) {
        if (reason == null || reason.isBlank()) {
            return "";
        }
        String cleaned = reason.replace(" | Requires manual review: user-selected level differs", "")
            .replace("Requires manual review: user-selected level differs | ", "")
            .replace("Requires manual review: user-selected level differs", "")
            .replace("  ", " ")
            .trim();
        if (cleaned.endsWith("|")) {
            cleaned = cleaned.substring(0, cleaned.length() - 1).trim();
        }
        return cleaned;
    }
}
