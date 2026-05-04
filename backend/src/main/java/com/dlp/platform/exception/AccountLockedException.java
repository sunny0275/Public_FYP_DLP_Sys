package com.dlp.platform.exception;

public class AccountLockedException extends RuntimeException {
    private final Integer lockoutMinutesRemaining;

    public AccountLockedException(String message, Integer lockoutMinutesRemaining) {
        super(message);
        this.lockoutMinutesRemaining = lockoutMinutesRemaining;
    }

    public Integer getLockoutMinutesRemaining() {
        return lockoutMinutesRemaining;
    }
}
