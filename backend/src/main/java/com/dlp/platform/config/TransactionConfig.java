package com.dlp.platform.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Configuration for programmatic transaction management.
 * Provides a TransactionTemplate with REQUIRES_NEW propagation for audit logging.
 */
@Configuration
public class TransactionConfig {

    /**
     * Create a TransactionTemplate with REQUIRES_NEW propagation.
     * This ensures that operations using this template run in their own transaction,
     * independent of any existing transaction in the caller.
     * 
     * This is critical for audit logging: when called from a method that has its own
     * transaction (like AuthService.login()), the audit logs must be saved in a
     * separate transaction to ensure they are not rolled back if the caller's
     * transaction fails.
     */
    @Bean
    public TransactionTemplate transactionTemplate(PlatformTransactionManager transactionManager) {
        TransactionTemplate template = new TransactionTemplate(transactionManager);
        template.setPropagationBehaviorName("PROPAGATION_REQUIRES_NEW");
        template.setIsolationLevelName("ISOLATION_DEFAULT");
        template.setTimeout(30); // 30 seconds timeout
        template.setReadOnly(false);
        return template;
    }
}
