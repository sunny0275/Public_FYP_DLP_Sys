package com.dlp.platform.security;

import com.dlp.platform.util.JwtUtil;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        try {
            String jwt = extractJwtFromRequest(request);
            
            if (jwt == null) {
                log.debug("No JWT token found in request for path: {}", request.getServletPath());
            } else {
                log.debug("JWT token found, validating for path: {}", request.getServletPath());

                if (jwtUtil.validateAccessToken(jwt)) {
                    String accountId = jwtUtil.extractAccountId(jwt);
                    log.debug("Token validated successfully for account: {}", accountId);

                    UserDetails userDetails = userDetailsService.loadUserByUsername(accountId);

                    if (userDetails instanceof UserDetailsServiceImpl.CustomUserDetails customUserDetails) {
                        if (!customUserDetails.isEnabled()) {
                            log.warn("Account {} is disabled", accountId);
                            filterChain.doFilter(request, response);
                            return;
                        }

                        Integer tokenVersion = jwtUtil.extractTokenVersion(jwt);
                        Integer currentTokenVersion = customUserDetails.getTokenVersion();
                        if (tokenVersion == null || !tokenVersion.equals(currentTokenVersion)) {
                            log.warn("Token version mismatch for account {}", accountId);
                            filterChain.doFilter(request, response);
                            return;
                        }
                    }

                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);

                    if (userDetails instanceof com.dlp.platform.security.UserDetailsServiceImpl.CustomUserDetails customUserDetails) {
                        request.setAttribute("currentUser", customUserDetails.getUser());
                        log.debug("Set currentUser attribute for: {}", accountId);
                    }

                    log.info("Authenticated user: {} for path: {}", accountId, request.getServletPath());
                } else {
                    log.warn("JWT token validation failed for path: {}", request.getServletPath());
                    trySetMinimalUserInfo(request);
                }
            }
        } catch (Exception e) {
            log.error("Cannot set user authentication for path {}: {}", request.getServletPath(), e.getMessage(), e);
            trySetMinimalUserInfo(request);
        }

        filterChain.doFilter(request, response);
    }

    private void trySetMinimalUserInfo(HttpServletRequest request) {
        try {
            String bearerToken = request.getHeader("Authorization");
            if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
                String jwt = bearerToken.substring(7);
                if (jwtUtil.validateAccessToken(jwt)) {
                    String accountId = jwtUtil.extractAccountId(jwt);
                    UserDetails userDetails = userDetailsService.loadUserByUsername(accountId);
                    if (userDetails instanceof com.dlp.platform.security.UserDetailsServiceImpl.CustomUserDetails customUserDetails) {
                        request.setAttribute("currentUser", customUserDetails.getUser());
                        log.debug("Set currentUser from token for: {}", accountId);
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Could not set minimal user info for audit: {}", e.getMessage());
        }
    }

    private String extractJwtFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        String path = request.getServletPath();
        return path.startsWith("/auth/login") || path.startsWith("/auth/refresh") ||
               path.equals("/health") || path.startsWith("/public/");
    }
}
