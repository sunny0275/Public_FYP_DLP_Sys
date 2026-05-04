-- Database initialization script for DLP Platform
-- This script is executed when the PostgreSQL container starts for the first time

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    account_id VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    department VARCHAR(100),
    position VARCHAR(100),

    -- MFA fields
    mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret VARCHAR(32),
    mfa_login_attempts INTEGER NOT NULL DEFAULT 0,

    -- Password policy fields
    first_login BOOLEAN NOT NULL DEFAULT TRUE,
    password_change_required BOOLEAN NOT NULL DEFAULT TRUE,
    password_changed_at TIMESTAMP,
    password_expiry_date TIMESTAMP,

    -- Account status fields
    account_locked BOOLEAN NOT NULL DEFAULT FALSE,
    account_locked_until TIMESTAMP,
    login_attempts INTEGER NOT NULL DEFAULT 0,
    account_lock_level INTEGER NOT NULL DEFAULT 0,
    account_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    -- Per-user signing keys (auto-sign / non-interactive flows)
    signing_private_key_enc TEXT,
    signing_public_key_hex TEXT,
    signing_key_created_at TIMESTAMP,

    -- UEBA risk score (nullable in app = treat as full trust)
    ueba_score INTEGER,

    -- JWT invalidation/versioning
    token_version INTEGER NOT NULL DEFAULT 1,

    -- System identities (exclude from normal user listings/metrics)
    system_account BOOLEAN NOT NULL DEFAULT FALSE,

    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    last_login_at TIMESTAMP,

    -- Logical deletion timestamp (restore window)
    deleted_at TIMESTAMP
);

-- Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_account_id ON users(account_id);
CREATE INDEX IF NOT EXISTS idx_email ON users(email);

-- Idempotent columns for existing volumes created before these fields existed
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_lock_level INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS signing_private_key_enc TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS signing_public_key_hex TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS signing_key_created_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ueba_score INTEGER;

-- Create user_roles table (for role mapping)
CREATE TABLE IF NOT EXISTS user_roles (
    user_id BIGINT NOT NULL,
    role VARCHAR(50) NOT NULL,
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    -- One user can have ONLY one role
    PRIMARY KEY (user_id)
);

-- Create user_password_history table
CREATE TABLE IF NOT EXISTS user_password_history (
    user_id BIGINT NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    history_order INTEGER NOT NULL,
    CONSTRAINT fk_password_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, history_order)
);

-- Create audit_log table
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    account_id VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    details TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_audit_log_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for audit_log table
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_account_id ON audit_log(account_id);

-- Watermark fingerprint mapping table
CREATE TABLE IF NOT EXISTS watermark_fingerprint (
    id BIGSERIAL PRIMARY KEY,
    payload_hash VARCHAR(64) NOT NULL,
    short_code VARCHAR(16) NULL,
    user_id BIGINT,
    device_id VARCHAR(128),
    document_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_watermark_fingerprint_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_watermark_payload_hash ON watermark_fingerprint(payload_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_watermark_short_code ON watermark_fingerprint(short_code) WHERE short_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_watermark_document_id ON watermark_fingerprint(document_id);

-- Migrate existing DB: add short_code if missing
ALTER TABLE watermark_fingerprint ADD COLUMN IF NOT EXISTS short_code VARCHAR(16) NULL;

-- Per-document envelope encryption metadata
CREATE TABLE IF NOT EXISTS document_keys (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL UNIQUE,
    owner_user_id BIGINT NOT NULL,
    key_version INTEGER NOT NULL,
    encrypted_dek TEXT NOT NULL,
    algorithm VARCHAR(50) NOT NULL DEFAULT 'AES/GCM/NoPadding',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_document_keys_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_key_document_id ON document_keys(document_id);
CREATE INDEX IF NOT EXISTS idx_document_key_owner_user_id ON document_keys(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_document_key_version ON document_keys(key_version);

-- USB policy table: defines which USB devices/users/hosts are allowed and how
CREATE TABLE IF NOT EXISTS usb_policy (
    id BIGSERIAL PRIMARY KEY,
    device_id VARCHAR(255),
    user_role VARCHAR(100),
    department VARCHAR(100),
    host_group VARCHAR(100),
    action VARCHAR(50) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    priority INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usb_policy_device_id ON usb_policy(device_id);
CREATE INDEX IF NOT EXISTS idx_usb_policy_user_role ON usb_policy(user_role);
CREATE INDEX IF NOT EXISTS idx_usb_policy_department ON usb_policy(department);
CREATE INDEX IF NOT EXISTS idx_usb_policy_host_group ON usb_policy(host_group);
CREATE INDEX IF NOT EXISTS idx_usb_policy_priority ON usb_policy(priority);

-- USB event table: records all USB insert/remove events + backend decision
CREATE TABLE IF NOT EXISTS usb_event (
    id BIGSERIAL PRIMARY KEY,
    event_time TIMESTAMP NOT NULL,
    username VARCHAR(255),
    host_name VARCHAR(255),
    host_group VARCHAR(100),
    user_role VARCHAR(100),
    department VARCHAR(100),
    device_id VARCHAR(255),
    vendor_id VARCHAR(50),
    product_id VARCHAR(50),
    serial_number VARCHAR(255),
    volume_label VARCHAR(255),
    capacity_bytes BIGINT,
    event_type VARCHAR(50) NOT NULL,
    decided_action VARCHAR(50) NOT NULL,
    decision_reason VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usb_event_username ON usb_event(username);
CREATE INDEX IF NOT EXISTS idx_usb_event_host_name ON usb_event(host_name);
CREATE INDEX IF NOT EXISTS idx_usb_event_device_id ON usb_event(device_id);
CREATE INDEX IF NOT EXISTS idx_usb_event_event_time ON usb_event(event_time);
CREATE INDEX IF NOT EXISTS idx_usb_event_decided_action ON usb_event(decided_action);

-- Key recovery job tracking for DEK re-wrap operations
CREATE TABLE IF NOT EXISTS key_recovery_jobs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL,
    total_docs INTEGER,
    processed_docs INTEGER,
    failed_docs INTEGER,
    error_message VARCHAR(1000),
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    CONSTRAINT fk_key_recovery_jobs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_key_recovery_job_user ON key_recovery_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_key_recovery_job_status ON key_recovery_jobs(status);

-- Backward-compatible schema extension for operational key wrapping.
ALTER TABLE IF EXISTS user_keys
    ADD COLUMN IF NOT EXISTS encrypted_operational_private_key TEXT;

ALTER TABLE IF EXISTS user_keys
    ADD COLUMN IF NOT EXISTS operational_key_id VARCHAR(64);

-- Insert default admin user
-- Default password: Opgg-58147321 (hashed with Argon2)
-- This will be hashed by the application, so we insert a placeholder
-- The DataInitializer will create the actual admin user with proper password hashing
INSERT INTO users (
    account_id,
    email,
    hashed_password,
    full_name,
    department,
    position,
    first_login,
    password_change_required,
    password_changed_at,
    password_expiry_date,
    account_enabled,
    created_at
) VALUES (
    'admin',
    'admin@dlp-platform.com',
    'placeholder',  -- Will be replaced by DataInitializer
    'System Administrator',
    'IT Department',
    'System Administrator',
    TRUE,
    TRUE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP + INTERVAL '30 days',
    TRUE,
    CURRENT_TIMESTAMP
) ON CONFLICT (account_id) DO NOTHING;

-- Insert admin role for default admin user
INSERT INTO user_roles (user_id, role)
SELECT id, 'ADMIN' FROM users WHERE account_id = 'admin'
ON CONFLICT DO NOTHING;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dlp_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dlp_user;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Database initialization completed successfully';
    RAISE NOTICE 'Default admin account: admin — password set by backend (default Opgg-58147321; override via ADMIN_PASSWORD / security.admin.password)';
    RAISE NOTICE 'Please change the default password on first login';
END $$;
