package com.dlp.platform.security;

import com.dlp.platform.dto.common.ApiResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Custom authentication entry point that returns structured JSON responses.
 * Distinguishes between disabled accounts (403) and regular authentication failures (401).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CustomAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
        String message = authException.getMessage() != null ? authException.getMessage() : "Authentication required";

        // Detect disabled account exception and return 403 with descriptive message
        if (message.toLowerCase().contains("disabled")) {
            response.setStatus(HttpStatus.FORBIDDEN.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            ApiResponse<Void> apiResponse = ApiResponse.error(
                    "Account is disabled. UEBA policy violation detected.",
                    message
            );
            objectMapper.writeValue(response.getWriter(), apiResponse);
            log.warn("Blocked disabled account access: {} from IP {}",
                    request.getRemoteAddr(), request.getServletPath());
            return;
        }

        // Regular unauthenticated access — return 401
        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        ApiResponse<Void> apiResponse = ApiResponse.error("Unauthorized", message);
        objectMapper.writeValue(response.getWriter(), apiResponse);
        log.debug("Unauthorized access attempt from {}: {}", request.getRemoteAddr(), message);
    }
}
