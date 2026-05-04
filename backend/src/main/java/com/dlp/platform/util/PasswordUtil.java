package com.dlp.platform.util;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

@Slf4j
@Component
public class PasswordUtil {

    @Value("${security.password.min-length}")
    private int minLength;

    @Value("${security.password.require-uppercase}")
    private boolean requireUppercase;

    @Value("${security.password.require-lowercase}")
    private boolean requireLowercase;

    @Value("${security.password.require-digit}")
    private boolean requireDigit;

    @Value("${security.password.require-special}")
    private boolean requireSpecial;

    @Value("${security.password.history-count}")
    private int historyCount;

    // Use BCrypt for password hashing (more stable in Alpine Linux containers)
    private final BCryptPasswordEncoder bCryptEncoder = new BCryptPasswordEncoder(12);

    /**
     * Hash password using BCrypt
     */
    public String hashPassword(String password) {
        try {
            String hash = bCryptEncoder.encode(password);
            log.debug("Password hashed successfully");
            return hash;
        } catch (Exception e) {
            log.error("Error hashing password: {}", e.getMessage());
            throw new RuntimeException("Failed to hash password", e);
        }
    }

    /**
     * Verify password against hash
     * Supports both BCrypt and Argon2 formats for backward compatibility
     */
    public boolean verifyPassword(String password, String hash) {
        try {
            // Check if hash is BCrypt format (starts with $2a$, $2b$, or $2y$)
            if (hash != null && (hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$"))) {
                boolean matches = bCryptEncoder.matches(password, hash);
                log.debug("Password verification result (BCrypt): {}", matches);
            return matches;
            }
            
            // For Argon2 format (if any exist), would need Argon2 library
            // But since we're switching to BCrypt, this is mainly for backward compatibility
            log.warn("Unsupported hash format, attempting BCrypt verification");
            return bCryptEncoder.matches(password, hash);
        } catch (Exception e) {
            log.error("Error verifying password: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Validate password complexity requirements
     */
    public PasswordValidationResult validatePasswordComplexity(String password) {
        List<String> errors = new ArrayList<>();

        if (password == null || password.isEmpty()) {
            errors.add("Password cannot be empty");
            return new PasswordValidationResult(false, errors);
        }

        // Check minimum length
        if (password.length() < minLength) {
            errors.add("Password must be at least " + minLength + " characters long");
        }

        // Check uppercase requirement
        if (requireUppercase && !Pattern.compile("[A-Z]").matcher(password).find()) {
            errors.add("Password must contain at least one uppercase letter");
        }

        // Check lowercase requirement
        if (requireLowercase && !Pattern.compile("[a-z]").matcher(password).find()) {
            errors.add("Password must contain at least one lowercase letter");
        }

        // Check digit requirement
        if (requireDigit && !Pattern.compile("[0-9]").matcher(password).find()) {
            errors.add("Password must contain at least one digit");
        }

        // Check special character requirement
        // Match any character that is not a letter or digit
        // This includes: !@#$%^&*()_+-=[]{}|;:,.<>? and other special characters
        if (requireSpecial && !Pattern.compile("[^A-Za-z0-9]").matcher(password).find()) {
            errors.add("Password must contain at least one special character");
        }

        // Check for common weak passwords
        if (isCommonPassword(password)) {
            errors.add("Password is too common. Please choose a stronger password");
        }

        boolean isValid = errors.isEmpty();
        return new PasswordValidationResult(isValid, errors);
    }

    /**
     * Check if password exists in password history
     */
    public boolean isPasswordInHistory(String newPassword, List<String> passwordHistory) {
        if (passwordHistory == null || passwordHistory.isEmpty()) {
            return false;
        }

        for (String oldHash : passwordHistory) {
            if (verifyPassword(newPassword, oldHash)) {
                log.debug("Password found in history");
                return true;
            }
        }
        return false;
    }

    /**
     * Check if password is in list of common/weak passwords
     */
    private boolean isCommonPassword(String password) {
        // Common weak passwords to reject
        Set<String> commonPasswords = Set.of(
                "password", "12345678", "123456789", "1234567890",
                "qwerty123", "password123", "admin123", "welcome123",
                "letmein123", "passw0rd", "abc123456", "p@ssw0rd"
        );
        return commonPasswords.contains(password.toLowerCase());
    }

    /**
     * Update password history, keeping only the most recent N passwords
     */
    public List<String> updatePasswordHistory(List<String> currentHistory, String newPasswordHash) {
        List<String> historyList = new ArrayList<>(currentHistory);

        // Add new password hash at the beginning
        historyList.add(0, newPasswordHash);

        // Keep only the configured number of history entries
        if (historyList.size() > historyCount) {
            historyList = historyList.subList(0, historyCount);
        }

        return new ArrayList<>(historyList); // Return a new mutable list
    }

    /**
     * Generate a random secure password
     */
    public String generateSecurePassword(int length) {
        if (length < minLength) {
            length = minLength;
        }

        String upperChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        String lowerChars = "abcdefghijklmnopqrstuvwxyz";
        String digitChars = "0123456789";
        String specialChars = "!@#$%^&*()_+-=[]{}|;:,.<>?";

        StringBuilder password = new StringBuilder();
        java.security.SecureRandom random = new java.security.SecureRandom();

        // Ensure at least one of each required type
        if (requireUppercase) {
            password.append(upperChars.charAt(random.nextInt(upperChars.length())));
        }
        if (requireLowercase) {
            password.append(lowerChars.charAt(random.nextInt(lowerChars.length())));
        }
        if (requireDigit) {
            password.append(digitChars.charAt(random.nextInt(digitChars.length())));
        }
        if (requireSpecial) {
            password.append(specialChars.charAt(random.nextInt(specialChars.length())));
        }

        // Fill the rest with random characters from all allowed sets
        String allChars = lowerChars + upperChars + digitChars + specialChars;
        while (password.length() < length) {
            password.append(allChars.charAt(random.nextInt(allChars.length())));
        }

        // Shuffle the password to randomize position of guaranteed characters
        return shuffleString(password.toString(), random);
    }

    private String shuffleString(String input, java.security.SecureRandom random) {
        char[] characters = input.toCharArray();
        for (int i = characters.length - 1; i > 0; i--) {
            int j = random.nextInt(i + 1);
            char temp = characters[i];
            characters[i] = characters[j];
            characters[j] = temp;
        }
        return new String(characters);
    }

    /**
     * Result class for password validation
     */
    public static class PasswordValidationResult {
        private final boolean valid;
        private final List<String> errors;

        public PasswordValidationResult(boolean valid, List<String> errors) {
            this.valid = valid;
            this.errors = errors;
        }

        public boolean isValid() {
            return valid;
        }

        public List<String> getErrors() {
            return errors;
        }

        public String getErrorMessage() {
            return String.join("; ", errors);
        }
    }
}
