package com.dlp.platform.config;

import com.dlp.platform.entity.User;
import com.dlp.platform.security.UserDetailsServiceImpl;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.MethodParameter;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

@Slf4j
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(new UserArgumentResolver());
    }

    /**
     * Custom argument resolver to convert CustomUserDetails to User entity
     * This allows @AuthenticationPrincipal User to work correctly
     */
    private static class UserArgumentResolver implements HandlerMethodArgumentResolver {

        @Override
        public boolean supportsParameter(MethodParameter parameter) {
            return parameter.getParameterType().equals(User.class) &&
                   parameter.hasParameterAnnotation(org.springframework.security.core.annotation.AuthenticationPrincipal.class);
        }

        @Override
        public Object resolveArgument(
                MethodParameter parameter,
                ModelAndViewContainer mavContainer,
                NativeWebRequest webRequest,
                WebDataBinderFactory binderFactory) {
            
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            
            if (authentication == null || authentication.getPrincipal() == null) {
                log.warn("No authentication found in security context");
                return null;
            }

            Object principal = authentication.getPrincipal();
            
            if (principal instanceof UserDetailsServiceImpl.CustomUserDetails) {
                UserDetailsServiceImpl.CustomUserDetails customUserDetails = 
                    (UserDetailsServiceImpl.CustomUserDetails) principal;
                return customUserDetails.getUser();
            }
            
            log.warn("Principal is not CustomUserDetails: {}", principal.getClass().getName());
            return null;
        }
    }
}

