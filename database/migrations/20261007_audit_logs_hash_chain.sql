-- =============================================================================
-- Migration: Add cryptographic hash chain columns to audit_logs
-- Date: 2026-10-07
-- Description:
--   Adds prev_hash and entry_hash to guarantee tamper evidence for forensic audit trails.
--   Each entry_hash is SHA-256(prev_hash | audit_id | user_id | evidence_id | action | details | created_at).
-- =============================================================================

ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS prev_hash VARCHAR(64);

ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS entry_hash VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entry_hash 
ON audit_logs(entry_hash);

CREATE INDEX IF NOT EXISTS idx_audit_logs_prev_hash 
ON audit_logs(prev_hash);

