-- Migration: Add is_legacy_seed column to evidence table
-- Date: 2026-10-05

ALTER TABLE evidence ADD COLUMN IF NOT EXISTS is_legacy_seed BOOLEAN DEFAULT FALSE;

-- Mark verified seed records initialized during database creation
UPDATE evidence 
SET is_legacy_seed = TRUE 
WHERE evidence_id IN (1, 2, 3) 
  AND encrypted_aes_key = 'temporary_key';
