-- Wipe ALL document library data (PostgreSQL).
-- This removes documents and all related records: versions, activities, tags join, signatures, and share links.
-- Also clears upload job records and workflow/task records that are typically tied to documents.
--
-- WARNING: Destructive. Use only in dev/test.
-- Tip: run inside a transaction first to confirm counts.

BEGIN;

-- Share tables
TRUNCATE TABLE share_ip_whitelist RESTART IDENTITY CASCADE;
TRUNCATE TABLE share_recipients RESTART IDENTITY CASCADE;
TRUNCATE TABLE share_links RESTART IDENTITY CASCADE;

-- Signature tables
TRUNCATE TABLE signatures RESTART IDENTITY CASCADE;

-- Upload jobs (may reference documents)
TRUNCATE TABLE upload_jobs RESTART IDENTITY CASCADE;

-- Workflow/task records (often reference documents/shares)
TRUNCATE TABLE tasks RESTART IDENTITY CASCADE;
TRUNCATE TABLE workflow_instances RESTART IDENTITY CASCADE;

-- Document relations
TRUNCATE TABLE document_activities RESTART IDENTITY CASCADE;
TRUNCATE TABLE document_versions RESTART IDENTITY CASCADE;
TRUNCATE TABLE document_tags RESTART IDENTITY CASCADE;

-- Documents
TRUNCATE TABLE documents RESTART IDENTITY CASCADE;

COMMIT;

-- NOTE: File deletion is handled by DocumentWipeService when deleteFiles=true.


