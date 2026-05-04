package com.dlp.platform.service.document;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.jdbc.datasource.DataSourceUtils;
import org.springframework.jdbc.datasource.init.ScriptException;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.sql.Connection;

/**
 * Utility for executing the destructive document-wipe SQL script.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class DocumentWipeService {

    private final DataSource dataSource;
    private final FileStorageService fileStorageService;
    private Resource wipeScript;

    @PostConstruct
    void init() {
        this.wipeScript = new ClassPathResource("sql/wipe_documents.sql");
    }

    public void wipeAllDocuments(boolean deleteFiles) {
        if (!wipeScript.exists()) {
            throw new IllegalStateException("Wipe script not found");
        }

        Connection connection = DataSourceUtils.getConnection(dataSource);
        try {
            ScriptUtils.executeSqlScript(connection, wipeScript);
            log.warn("Document library wiped via wipe_documents.sql");

            if (deleteFiles) {
                try {
                    fileStorageService.purgeAllFiles();
                } catch (Exception e) {
                    // Keep DB wipe successful even if file deletion fails (non-fatal)
                    log.warn("Failed to purge upload files (non-fatal): {}", e.getMessage(), e);
                }
            }
        } catch (ScriptException e) {
            throw new RuntimeException("Failed to execute document wipe script", e);
        } finally {
            DataSourceUtils.releaseConnection(connection, dataSource);
        }
    }
}


