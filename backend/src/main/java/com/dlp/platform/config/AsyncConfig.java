package com.dlp.platform.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableAsync
@EnableScheduling
public class AsyncConfig {
    // Enables @Async annotation for asynchronous method execution
    // Used by AuditService to log events without blocking main thread
    // Enables @Scheduled annotation for periodic tasks
    // Used by RateLimitFilter to cleanup expired entries
}
