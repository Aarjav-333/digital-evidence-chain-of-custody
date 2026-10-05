-- =============================================================================
-- DIG_EVI — Seed Demo Data for Fresh PostgreSQL Database
-- =============================================================================

-- 1. Insert Base System Roles (if not already present)
INSERT INTO roles (role_name)
VALUES
    ('System Administrator'),
    ('Police Officer'),
    ('Case Manager'),
    ('Forensic Analyst')
ON CONFLICT (role_name) DO NOTHING;

-- 2. Insert Standard Demonstration Users (Password: Admin@123 for all demo accounts)
INSERT INTO users (employee_id, role_id, password_hash, full_name, email, phone_number, is_active)
VALUES
    (
        'POL2026002',
        1,
        '$2b$10$5C6GUnClupGGPgdGP5HuZuEZnvboP6PM/Gqlpb2fHn8POgt51N8h.',
        'System Administrator',
        'admin2@police.gov.in',
        '9876543210',
        TRUE
    ),
    (
        'POL2026001',
        2,
        '$2b$10$sve1GsbX9NU9WDrEj6B5Y.pT8U4OC0vvo25fY1IgMUmZT2LXF7ut6',
        'Officer John Davis (Investigator)',
        'john.davis@police.gov.in',
        '9876543211',
        TRUE
    ),
    (
        'CAS2026001',
        3,
        '$2b$10$sve1GsbX9NU9WDrEj6B5Y.pT8U4OC0vvo25fY1IgMUmZT2LXF7ut6',
        'Robert Miller (Case Manager)',
        'robert.miller@police.gov.in',
        '9876543212',
        TRUE
    ),
    (
        'FOR2026001',
        4,
        '$2b$10$sve1GsbX9NU9WDrEj6B5Y.pT8U4OC0vvo25fY1IgMUmZT2LXF7ut6',
        'Dr. Sarah Jenkins (Forensic Specialist)',
        'sarah.analyst@forensics.gov.in',
        '9876543213',
        TRUE
    ),
    (
        'POL2026003',
        4,
        '$2b$10$sve1GsbX9NU9WDrEj6B5Y.pT8U4OC0vvo25fY1IgMUmZT2LXF7ut6',
        'Forensic Officer',
        'forensic@police.gov.in',
        '9876543214',
        TRUE
    )
ON CONFLICT (employee_id) DO NOTHING;
