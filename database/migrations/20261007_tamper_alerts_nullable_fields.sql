-- =============================================================================
-- Migration: Allow NULL evidence_id and stored_hash in tamper_alerts
-- Date: 2026-10-07
-- Description:
--   System alerts (e.g. AUDIT_CHAIN_BROKEN, MANIFEST_TAMPERED) and storage-level
--   alerts (e.g. UNREGISTERED_FILE) do not have a database evidence_id or stored_hash.
-- =============================================================================

ALTER TABLE tamper_alerts 
ALTER COLUMN evidence_id DROP NOT NULL;

ALTER TABLE tamper_alerts 
ALTER COLUMN stored_hash DROP NOT NULL;

