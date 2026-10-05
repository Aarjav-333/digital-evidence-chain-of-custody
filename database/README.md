# DIG_EVI Database Setup Guide

This directory contains the complete and reproducible PostgreSQL database schema and seed data for the **DIG_EVI** Digital Evidence Chain of Custody & Forensic Management System.

---

## Files

1. **`schema.sql`**  
   Contains complete DDL definitions for all 9 application tables, foreign keys, constraints, and performance indexes:
   - `roles`
   - `users`
   - `cases`
   - `evidence`
   - `custody_logs`
   - `audit_logs`
   - `tamper_alerts`
   - `forensic_reports`
   - `autopsy_records`

2. **`seed_demo_data.sql`**  
   Contains initial seed rows for system roles (Admin, Officer, Case Manager, Forensic Analyst) and demonstration user accounts.

---

## Initializing a Fresh Database

### Option A: Using PostgreSQL CLI (`psql`)

```bash
# 1. Create the database (if not created yet)
psql -U postgres -c "CREATE DATABASE digital_evidence_db;"

# 2. Run the schema file
psql -U postgres -d digital_evidence_db -f database/schema.sql

# 3. Seed demo accounts (optional)
psql -U postgres -d digital_evidence_db -f database/seed_demo_data.sql
```

### Option B: Using the Node.js Initializer

From the `backend` folder:
```bash
node src/config/initTables.js
```

---

## Default Demo User Accounts

All demo accounts use password: `Admin@123`

| Employee ID | Role Name | Assigned User Name |
| :--- | :--- | :--- |
| `POL2026002` | System Administrator (1) | System Administrator |
| `POL2026001` | Police Officer (2) | Officer John Davis (Investigator) |
| `CAS2026001` | Case Manager (3) | Robert Miller (Case Manager) |
| `FOR2026001` | Forensic Analyst (4) | Dr. Sarah Jenkins (Forensic Specialist) |
| `POL2026003` | Forensic Analyst (4) | Forensic Officer |
