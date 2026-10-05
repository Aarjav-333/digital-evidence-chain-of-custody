-- =============================================================================
-- DIG_EVI — Digital Evidence Chain of Custody & Management System
-- Complete Database Schema for PostgreSQL
-- =============================================================================

-- 1. ROLES
CREATE TABLE IF NOT EXISTS roles (
    role_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE
);

-- 2. USERS
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_id VARCHAR(20) NOT NULL UNIQUE,
    role_id INTEGER NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    phone_number VARCHAR(15),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE RESTRICT
);

-- 3. CASES
CREATE TABLE IF NOT EXISTS cases (
    case_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    case_number VARCHAR(50) NOT NULL UNIQUE,
    case_title VARCHAR(150) NOT NULL,
    case_description TEXT,
    investigating_officer INTEGER,
    created_by INTEGER,
    status VARCHAR(50) DEFAULT 'OPEN',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cases_investigating_officer FOREIGN KEY (investigating_officer) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT fk_cases_created_by FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- 4. EVIDENCE
CREATE TABLE IF NOT EXISTS evidence (
    evidence_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    evidence_number VARCHAR(50) NOT NULL UNIQUE,
    case_id INTEGER NOT NULL,
    evidence_name VARCHAR(150) NOT NULL,
    evidence_type VARCHAR(100),
    description TEXT,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    encrypted_aes_key TEXT,
    encryption_iv TEXT,
    encryption_auth_tag TEXT,
    uploaded_by INTEGER,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_evidence_case FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE,
    CONSTRAINT fk_evidence_uploader FOREIGN KEY (uploaded_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- 5. CUSTODY LOGS
CREATE TABLE IF NOT EXISTS custody_logs (
    custody_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    evidence_id INTEGER NOT NULL,
    from_user INTEGER,
    to_user INTEGER,
    action VARCHAR(50) NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_custody_evidence FOREIGN KEY (evidence_id) REFERENCES evidence(evidence_id) ON DELETE CASCADE,
    CONSTRAINT fk_custody_from_user FOREIGN KEY (from_user) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT fk_custody_to_user FOREIGN KEY (to_user) REFERENCES users(user_id) ON DELETE SET NULL
);

-- 6. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    audit_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER,
    evidence_id INTEGER,
    action VARCHAR(50) NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT fk_audit_evidence FOREIGN KEY (evidence_id) REFERENCES evidence(evidence_id) ON DELETE SET NULL
);

-- 7. TAMPER ALERTS
CREATE TABLE IF NOT EXISTS tamper_alerts (
    alert_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    evidence_id INTEGER,
    case_id INTEGER,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) DEFAULT 'CRITICAL',
    stored_hash VARCHAR(64),
    detected_hash VARCHAR(64),
    file_path TEXT,
    message TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_by INTEGER,
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    CONSTRAINT fk_alerts_evidence FOREIGN KEY (evidence_id) REFERENCES evidence(evidence_id) ON DELETE CASCADE,
    CONSTRAINT fk_alerts_case FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE SET NULL,
    CONSTRAINT fk_alerts_resolved_by FOREIGN KEY (resolved_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- 8. FORENSIC REPORTS
CREATE TABLE IF NOT EXISTS forensic_reports (
    report_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_number VARCHAR(50) NOT NULL UNIQUE,
    case_id INTEGER,
    evidence_id INTEGER,
    analyst_id INTEGER,
    report_title VARCHAR(200) NOT NULL,
    report_type VARCHAR(100) DEFAULT 'EXAMINATION_REPORT',
    tools_used VARCHAR(255),
    hash_verified BOOLEAN DEFAULT TRUE,
    findings TEXT,
    artifacts_recovered TEXT,
    conclusion TEXT,
    status VARCHAR(50) DEFAULT 'DRAFT',
    recipient_id INTEGER,
    recipient_name VARCHAR(100),
    recipient_agency VARCHAR(100),
    transmission_priority VARCHAR(20) DEFAULT 'NORMAL',
    dispatch_notes TEXT,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reports_case FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE SET NULL,
    CONSTRAINT fk_reports_evidence FOREIGN KEY (evidence_id) REFERENCES evidence(evidence_id) ON DELETE SET NULL,
    CONSTRAINT fk_reports_analyst FOREIGN KEY (analyst_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT fk_reports_recipient FOREIGN KEY (recipient_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- 9. AUTOPSY RECORDS
CREATE TABLE IF NOT EXISTS autopsy_records (
    autopsy_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    autopsy_number VARCHAR(50) NOT NULL UNIQUE,
    case_id INTEGER,
    evidence_id INTEGER,
    examiner_id INTEGER,
    subject_name VARCHAR(150),
    device_type VARCHAR(100),
    hardware_condition VARCHAR(255),
    extraction_method VARCHAR(255),
    autopsy_findings TEXT,
    triage_summary TEXT,
    status VARCHAR(50) DEFAULT 'COMPLETED',
    dispatched_to VARCHAR(150),
    recipient_id INTEGER,
    dispatch_notes TEXT,
    dispatched_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_autopsy_case FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE SET NULL,
    CONSTRAINT fk_autopsy_evidence FOREIGN KEY (evidence_id) REFERENCES evidence(evidence_id) ON DELETE SET NULL,
    CONSTRAINT fk_autopsy_examiner FOREIGN KEY (examiner_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT fk_autopsy_recipient FOREIGN KEY (recipient_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- =============================================================================
-- PERFORMANCE & INTEGRITY INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);
CREATE INDEX IF NOT EXISTS idx_cases_case_number ON cases(case_number);
CREATE INDEX IF NOT EXISTS idx_evidence_case_id ON evidence(case_id);
CREATE INDEX IF NOT EXISTS idx_evidence_number ON evidence(evidence_number);
CREATE INDEX IF NOT EXISTS idx_custody_evidence_id ON custody_logs(evidence_id);
CREATE INDEX IF NOT EXISTS idx_audit_evidence_id ON audit_logs(evidence_id);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_evidence_id ON tamper_alerts(evidence_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON tamper_alerts(status);
CREATE INDEX IF NOT EXISTS idx_reports_case_id ON forensic_reports(case_id);
CREATE INDEX IF NOT EXISTS idx_reports_report_number ON forensic_reports(report_number);
CREATE INDEX IF NOT EXISTS idx_autopsies_case_id ON autopsy_records(case_id);
CREATE INDEX IF NOT EXISTS idx_autopsies_number ON autopsy_records(autopsy_number);
