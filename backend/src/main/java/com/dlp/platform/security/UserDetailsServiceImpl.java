package com.dlp.platform.security;

import com.dlp.platform.entity.User;
import com.dlp.platform.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String accountId) throws UsernameNotFoundException {
        log.debug("Loading user by account ID: {}", accountId);

        User user = userRepository.findByAccountId(accountId)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + accountId));

        return new CustomUserDetails(user);
    }

    /**
     * Custom UserDetails implementation
     */
    public static class CustomUserDetails implements UserDetails {

        private final User user;
        private final Collection<? extends GrantedAuthority> authorities;

        public CustomUserDetails(User user) {
            this.user = user;
            this.authorities = user.getRoles().stream()
                    .map(role -> {
                        // Normalize: strip existing ROLE_ prefix if present, then add it back consistently
                        String normalized = role.toUpperCase().replace("ROLE_", "");
                        return new SimpleGrantedAuthority("ROLE_" + normalized);
                    })
                    .collect(Collectors.toList());
        }

        @Override
        public Collection<? extends GrantedAuthority> getAuthorities() {
            return authorities;
        }

        @Override
        public String getPassword() {
            return user.getHashedPassword();
        }

        @Override
        public String getUsername() {
            return user.getAccountId();
        }

        @Override
        public boolean isAccountNonExpired() {
            return true;
        }

        @Override
        public boolean isAccountNonLocked() {
            return !user.isAccountLocked();
        }

        @Override
        public boolean isCredentialsNonExpired() {
            return !user.isPasswordExpired();
        }

        @Override
        public boolean isEnabled() {
            return user.getAccountEnabled();
        }

        public User getUser() {
            return user;
        }

        public Long getUserId() {
            return user.getId();
        }

        public String getAccountId() {
            return user.getAccountId();
        }

        public String getEmail() {
            return user.getEmail();
        }

        public boolean isMfaEnabled() {
            return user.getMfaEnabled();
        }

        public boolean isFirstLogin() {
            return user.getFirstLogin();
        }

        public boolean isPasswordChangeRequired() {
            return user.getPasswordChangeRequired();
        }

        public Integer getTokenVersion() {
            return user.getTokenVersion();
        }
    }
}
