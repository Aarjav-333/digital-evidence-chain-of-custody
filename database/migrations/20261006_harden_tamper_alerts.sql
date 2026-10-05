-- Migration: Harden tamper_alerts with email dispatch telemetry and partial unique index
-- Date: 2026-10-06

-- 1. Add email dispatch status & retry tracking columns
ALTER TABLE tamper_alerts ADD COLUMN IF NOT EXISTS email_status VARCHAR(20) DEFAULT 'PENDING';
ALTER TABLE tamper_alerts ADD COLUMN IF NOT EXISTS email_attempts INTEGER DEFAULT 0;
ALTER TABLE tamper_alerts ADD COLUMN IF NOT EXISTS email_last_error TEXT;
ALTER TABLE tamper_alerts ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP;

-- 2. Backfill existing historical alerts
UPDATE tamper_alerts 
SET email_status = 'SENT' 
WHERE status = 'RESOLVED' AND email_status IS NULL;

UPDATE tamper_alerts 
SET email_status = 'PENDING' 
WHERE status = 'ACTIVE' AND email_status IS NULL;

-- 3. Ensure deduplication of any existing active duplicate alerts before index creation
DELETE FROM tamper_alerts a
USING tamper_alerts b
WHERE a.alert_id < b.alert_id
  AND a.evidence_id = b.evidence_id
  AND a.alert_type = b.alert_type
  AND a.status = 'ACTIVE'
  AND b.status = 'ACTIVE';

-- 4. Partial unique index to enforce single active alert per evidence per alert type
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_tamper_alerts_unique
ON tamper_alerts (evidence_id, alert_type)
WHERE status = 'ACTIVE';
