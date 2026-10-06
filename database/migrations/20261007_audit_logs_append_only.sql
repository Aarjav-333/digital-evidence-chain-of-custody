-- =============================================================================
-- Migration: Enforce Append-Only Immutability on audit_logs Table
-- Date: 2026-10-07
-- Description:
--   Guarantees that forensic audit logs cannot be edited (UPDATE) or deleted (DELETE).
--   This enforces cryptographic hash chain integrity at the database engine level.
--
-- NOTE: Do NOT execute this migration until approved by the system administrator.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Option A: PostgreSQL Blocking Trigger (Recommended)
-- Works across all connecting users, including table owners and superusers.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_audit_logs_append_only()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'SECURITY VIOLATION: audit_logs is append-only. UPDATE operations are strictly prohibited.';
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'SECURITY VIOLATION: audit_logs is append-only. DELETE operations are strictly prohibited.';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_append_only ON audit_logs;

CREATE TRIGGER trg_audit_logs_append_only
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION enforce_audit_logs_append_only();

-- -----------------------------------------------------------------------------
-- Option B: Role Privilege Revocation (For non-owner application role, e.g. app_user)
-- -----------------------------------------------------------------------------
-- REVOKE UPDATE, DELETE, TRUNCATE ON TABLE audit_logs FROM app_user;
-- GRANT INSERT, SELECT ON TABLE audit_logs TO app_user;
-- GRANT USAGE, SELECT ON SEQUENCE public.audit_logs_audit_id_seq TO app_user;

