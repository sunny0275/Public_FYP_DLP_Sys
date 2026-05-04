-- Spring Boot executes `schema.sql` on startup because `spring.sql.init.mode=always`.
-- Keep this file **idempotent** and safe to run repeatedly.
--
-- IMPORTANT:
-- Spring's SQL initializer splits statements by semicolons. Do NOT use PostgreSQL
-- `DO $$ ... $$` blocks here; they will be split mid-block and fail.
--
-- Purpose: migrate older DBs so Hibernate/JPA can start cleanly (and so
-- `DataInitializer` can query `users` without crashing).

-- Ensure `users` table exists (minimal). Hibernate will add the rest of the schema.
CREATE TABLE IF NOT EXISTS public.users (
    id BIGSERIAL PRIMARY KEY
);

-- Ensure new NOT NULL columns exist with defaults so existing rows don't violate constraints.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS mfa_login_attempts INTEGER;
ALTER TABLE public.users ALTER COLUMN mfa_login_attempts SET DEFAULT 0;
UPDATE public.users SET mfa_login_attempts = 0 WHERE mfa_login_attempts IS NULL;
ALTER TABLE public.users ALTER COLUMN mfa_login_attempts SET NOT NULL;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS system_account BOOLEAN;
ALTER TABLE public.users ALTER COLUMN system_account SET DEFAULT FALSE;
UPDATE public.users SET system_account = FALSE WHERE system_account IS NULL;
ALTER TABLE public.users ALTER COLUMN system_account SET NOT NULL;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS token_version INTEGER;
ALTER TABLE public.users ALTER COLUMN token_version SET DEFAULT 1;
UPDATE public.users SET token_version = 1 WHERE token_version IS NULL;
ALTER TABLE public.users ALTER COLUMN token_version SET NOT NULL;

-- Enforce SINGLE ROLE per user (DB-level), and normalize legacy values.
-- This makes ERD and integrity correct: user_roles.user_id is the PK and FK to users.id.
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id BIGINT NOT NULL,
    role VARCHAR(50) NOT NULL
);

-- Normalize role values: trim/uppercase, strip ROLE_ prefix, map legacy USER -> EMPLOYEE
UPDATE public.user_roles SET role = UPPER(TRIM(role)) WHERE role IS NOT NULL;
UPDATE public.user_roles SET role = regexp_replace(role, '^ROLE_', '') WHERE role LIKE 'ROLE_%';
UPDATE public.user_roles SET role = 'EMPLOYEE' WHERE role = 'USER';

-- Dedupe to ONE role per user (keep the highest-privilege role deterministically)
-- Only 4 roles exist: ADMIN, MANAGER, REVIEWER, EMPLOYEE
WITH ranked AS (
    SELECT
        ctid,
        user_id,
        ROW_NUMBER() OVER (
            PARTITION BY user_id
            ORDER BY
                CASE role
                    WHEN 'ADMIN' THEN 40
                    WHEN 'MANAGER' THEN 30
                    WHEN 'REVIEWER' THEN 20
                    WHEN 'EMPLOYEE' THEN 10
                    ELSE 0
                END DESC,
                role ASC
        ) AS rn
    FROM public.user_roles
)
DELETE FROM public.user_roles ur
USING ranked r
WHERE ur.ctid = r.ctid AND r.rn > 1;

-- Migrate any deprecated roles to EMPLOYEE (default lowest privilege)
UPDATE public.user_roles SET role = 'EMPLOYEE' WHERE role IN ('CEO', 'SUPERVISOR', 'SECURITY_ANALYST', 'COMPLIANCE_OFFICER');

-- Ensure FK + PK are correct (drop and recreate with stable names)
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS fk_user_roles_user;
ALTER TABLE public.user_roles ADD CONSTRAINT fk_user_roles_user
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_pkey;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id);


