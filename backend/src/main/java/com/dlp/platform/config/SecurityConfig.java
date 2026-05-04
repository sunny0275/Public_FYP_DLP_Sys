package com.dlp.platform.config;

import com.dlp.platform.security.JwtAuthenticationFilter;
import com.dlp.platform.security.RateLimitFilter;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.HeadersConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.CorsUtils;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

/**
 * Spring Security configuration for the DLP Platform.
 * 
 * Security audit logging (UNAUTHORIZED_ACCESS) is handled centrally by:
 * 1. GlobalExceptionHandler.handleAccessDenied() - primary handler for AccessDeniedException
 * 2. AccessDeniedAuditAspect - safety net for exceptions escaping from controllers
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final RateLimitFilter rateLimitFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // Disable CSRF (we're using JWT tokens)
                .csrf(AbstractHttpConfigurer::disable)

                // Enable CORS
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))

                // Configure headers - allow same-origin framing for document preview
                .headers(headers -> headers
                        .frameOptions(HeadersConfigurer.FrameOptionsConfig::sameOrigin)
                )

                // Set session management to stateless
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )

                // Configure authorization rules
                .authorizeHttpRequests(auth -> auth
                        // Always allow CORS preflight requests
                        .requestMatchers(CorsUtils::isPreFlightRequest).permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // Public endpoints
                        .requestMatchers("/auth/login").permitAll()
                        .requestMatchers("/auth/refresh").permitAll()
                        .requestMatchers("/auth/forgot-password").permitAll()
                        .requestMatchers("/health").permitAll()
                        .requestMatchers("/public/**").permitAll()
                        // Endpoint/EDR agent callbacks (device telemetry)
                        .requestMatchers("/agent/**").permitAll()
                        // Security events from Electron/Desktop agent (no JWT needed, accountId in request body)
                        .requestMatchers("/security/**").permitAll()

                        // Share link access (anonymous users open /shared/{token})
                        .requestMatchers(HttpMethod.GET, "/shares/*").permitAll()
                        .requestMatchers(HttpMethod.GET, "/shares/*/preview").permitAll()
                        .requestMatchers(HttpMethod.GET, "/shares/*/download").permitAll()
                        .requestMatchers(HttpMethod.POST, "/shares/*/access-log").permitAll()

                        // Admin endpoints
                        .requestMatchers("/admin/**").hasRole("ADMIN")

                        // All other endpoints require authentication
                        .anyRequest().authenticated()
                )

                // Add rate limiting filter before JWT filter
                .addFilterBefore(rateLimitFilter, UsernamePasswordAuthenticationFilter.class)

                // Add JWT authentication filter
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)

                // Exception handling
                // NOTE: Audit logging and UEBA score deduction for AccessDeniedException is handled
                // centrally in GlobalExceptionHandler.handleAccessDenied() (primary handler) and
                // AccessDeniedAuditAspect (safety net). This keeps audit logic in one place.
                .exceptionHandling(exception -> exception
                        .authenticationEntryPoint((request, response, authException) -> {
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            response.setContentType("application/json");
                            response.getWriter().write(
                                    "{\"error\": \"Unauthorized\", \"message\": \"" +
                                            authException.getMessage() + "\"}"
                            );
                        })
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                            // Only write response - audit/UEBA is handled by GlobalExceptionHandler/AccessDeniedAuditAspect
                            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                            response.setContentType("application/json");
                            com.dlp.platform.dto.common.ApiResponse<Void> apiResponse =
                                    com.dlp.platform.dto.common.ApiResponse.error(
                                            "Access Denied",
                                            accessDeniedException.getMessage() != null
                                                    ? accessDeniedException.getMessage()
                                                    : "You do not have permission to access this resource."
                                    );
                            response.getWriter().write(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(apiResponse));
                        })
                );

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        // Frontend runs on varying host ports in Docker Compose on Windows (published: 0),
        // so allow localhost/127.0.0.1 on any port.
        configuration.setAllowedOriginPatterns(List.of(
                "http://localhost:*",
                "http://127.0.0.1:*"
        ));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        configuration.setAllowedHeaders(Arrays.asList("*"));
        configuration.setExposedHeaders(Arrays.asList(
                "Authorization",
                "Content-Type",
                "X-Watermark-Code",
                "X-Viewer-IP"
        ));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }

    /**
     * Password encoder bean
     * Note: We use Argon2 in PasswordUtil for actual password hashing,
     * but Spring Security requires a PasswordEncoder bean
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
