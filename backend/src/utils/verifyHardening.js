/**
 * =============================================================================
 * DIG_EVI — Integrity Monitor Hardening Automated Verification Script
 * =============================================================================
 *
 * Verifies the three critical hardening requirements:
 * 1. A tampered file raises exactly one alert and one email across 3 scans.
 * 2. A forced SMTP failure retries and recovers to SENT.
 * 3. Two overlapping scans create exactly one alert (protected by mutex guard).
 *
 * Safety Guards:
 * - Refuses execution if NODE_ENV === 'production'
 * - Uses ONLY test exhibit EV-2026-012 (evidence_id: 14)
 * - Safe bit-for-bit backup and restore in try/finally
 * - Non-destructive and idempotent
 *
 * Usage:
 *   node backend/src/utils/verifyHardening.js
 * =============================================================================
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const fs = require("fs");
const crypto = require("crypto");
const pool = require("../config/db");
const alertService = require("../services/alertService");
const alertModel = require("../models/alertModel");
const emailService = require("../services/emailService");

if (process.env.NODE_ENV === "production") {
    console.error("FATAL: Refusing to run verification script in production environment.");
    process.exit(1);
}

const TEST_EVIDENCE_ID = 14;
const BACKUP_DIR = path.resolve(__dirname, "../../../scratch/backups");

async function cleanActiveAlertsForExhibit(evidenceId) {
    const adminRes = await pool.query("SELECT user_id FROM users WHERE role_id = 1 AND is_active = TRUE LIMIT 1;");
    const adminId = adminRes.rows[0] ? adminRes.rows[0].user_id : null;
    const active = await pool.query("SELECT alert_id FROM tamper_alerts WHERE evidence_id = $1 AND status = 'ACTIVE';", [evidenceId]);
    for (const row of active.rows) {
        await alertModel.resolveAlert(row.alert_id, adminId, "[AUTO-TEST CLEANUP] Resolved prior test alert");
    }
}

async function runHardeningVerification() {
    console.log("================================================================================");
    console.log("      DIG_EVI — INTEGRITY MONITOR HARDENING VERIFICATION TEST SUITE             ");
    console.log("================================================================================\n");

    process.env.DEMO_MAIL = "true";

    const evRes = await pool.query("SELECT * FROM evidence WHERE evidence_id = $1;", [TEST_EVIDENCE_ID]);
    if (evRes.rows.length === 0) {
        throw new Error(`Test exhibit #${TEST_EVIDENCE_ID} not found in database!`);
    }
    const testExhibit = evRes.rows[0];
    const encFilePath = path.resolve(testExhibit.file_path);

    if (!fs.existsSync(encFilePath)) {
        throw new Error(`Test exhibit file does not exist at: ${encFilePath}`);
    }

    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    const backupFilePath = path.join(BACKUP_DIR, `${path.basename(encFilePath)}.bak`);
    fs.copyFileSync(encFilePath, backupFilePath);
    const originalBytes = fs.readFileSync(encFilePath);
    const originalHash = crypto.createHash("sha256").update(originalBytes).digest("hex");

    console.log(`[Setup] Target Exhibit: #${testExhibit.evidence_id} (${testExhibit.evidence_number})`);
    console.log(`[Setup] File Path:      ${encFilePath}`);
    console.log(`[Setup] Baseline Hash:  ${originalHash}`);
    console.log(`[Setup] Backup created: ${backupFilePath}\n`);

    try {
        // =========================================================================
        // TEST 1: Tampered file raises exactly 1 alert and 1 email across 3 scans
        // =========================================================================
        console.log("--------------------------------------------------------------------------------");
        console.log("TEST 1: Tampered file raises exactly 1 alert and 1 email across 3 scans");
        console.log("--------------------------------------------------------------------------------");

        await cleanActiveAlertsForExhibit(TEST_EVIDENCE_ID);

        const tamperedBytes = Buffer.from(originalBytes);
        tamperedBytes[0] = tamperedBytes[0] ^ 0xff;
        fs.writeFileSync(encFilePath, tamperedBytes);

        console.log("[Test 1] Exhibit ciphertext modified (flipped byte 0).");
        console.log("[Test 1] Executing Scan 1...");
        const scan1 = await alertService.scanAllEvidenceIntegrity();
        console.log(`[Test 1] Scan 1 finished. New alerts dispatched: ${scan1.new_alerts_dispatched}`);

        const alertRes1 = await pool.query(
            "SELECT * FROM tamper_alerts WHERE evidence_id = $1 AND status = 'ACTIVE';",
            [TEST_EVIDENCE_ID]
        );
        if (alertRes1.rows.length !== 1) {
            throw new Error(`Test 1 FAILED: Expected exactly 1 active alert after Scan 1, found ${alertRes1.rows.length}`);
        }
        const createdAlertId = alertRes1.rows[0].alert_id;
        const emailStatus1 = alertRes1.rows[0].email_status;
        const emailAttempts1 = alertRes1.rows[0].email_attempts;
        console.log(`[Test 1] Alert created: #${createdAlertId}, email_status: ${emailStatus1}, email_attempts: ${emailAttempts1}`);

        if (emailStatus1 !== "SENT" || emailAttempts1 !== 1) {
            throw new Error(`Test 1 FAILED: Expected email_status='SENT' and attempts=1 after Scan 1, got ${emailStatus1} / ${emailAttempts1}`);
        }

        console.log("[Test 1] Executing Scan 2 (file remains tampered)...");
        const scan2 = await alertService.scanAllEvidenceIntegrity();
        console.log(`[Test 1] Scan 2 finished. New alerts dispatched: ${scan2.new_alerts_dispatched}`);

        console.log("[Test 1] Executing Scan 3 (file remains tampered)...");
        const scan3 = await alertService.scanAllEvidenceIntegrity();
        console.log(`[Test 1] Scan 3 finished. New alerts dispatched: ${scan3.new_alerts_dispatched}`);

        const alertResAfter3 = await pool.query(
            "SELECT * FROM tamper_alerts WHERE evidence_id = $1 AND status = 'ACTIVE';",
            [TEST_EVIDENCE_ID]
        );
        if (alertResAfter3.rows.length !== 1) {
            throw new Error(`Test 1 FAILED: Expected still exactly 1 active alert after 3 scans, found ${alertResAfter3.rows.length}`);
        }

        const alertAfter3 = alertResAfter3.rows[0];
        console.log(`[Test 1] Alert state after 3 scans: #${alertAfter3.alert_id}, email_status: ${alertAfter3.email_status}, email_attempts: ${alertAfter3.email_attempts}`);

        if (alertAfter3.email_attempts !== 1) {
            throw new Error(`Test 1 FAILED: Expected email_attempts to stay 1 (no duplicate emails), got ${alertAfter3.email_attempts}`);
        }

        console.log(">>> [PASS] TEST 1: Exactly 1 alert created and exactly 1 email sent across 3 scans.\n");
        await cleanActiveAlertsForExhibit(TEST_EVIDENCE_ID);

        // =========================================================================
        // TEST 2: Forced SMTP failure retries and recovers
        // =========================================================================
        console.log("--------------------------------------------------------------------------------");
        console.log("TEST 2: Forced SMTP failure retries and recovers");
        console.log("--------------------------------------------------------------------------------");

        fs.writeFileSync(encFilePath, tamperedBytes);
        const originalSendEmail = emailService.sendTamperAlertEmail;

        emailService.sendTamperAlertEmail = async () => {
            console.log("[Test 2 Mock] Simulating SMTP network failure: ECONNREFUSED...");
            return {
                sent: false,
                error: "ECONNREFUSED: Connection refused to mail server"
            };
        };

        console.log("[Test 2] Triggering scan with forced SMTP failure...");
        const scanFail = await alertService.scanAllEvidenceIntegrity();
        console.log(`[Test 2] Scan finished. New alerts dispatched: ${scanFail.new_alerts_dispatched}`);

        const failedAlertRes = await pool.query(
            "SELECT * FROM tamper_alerts WHERE evidence_id = $1 AND status = 'ACTIVE';",
            [TEST_EVIDENCE_ID]
        );
        if (failedAlertRes.rows.length !== 1) {
            throw new Error(`Test 2 FAILED: Expected 1 active alert, found ${failedAlertRes.rows.length}`);
        }
        const failedAlert = failedAlertRes.rows[0];
        console.log(`[Test 2] Alert state after SMTP failure: email_status: '${failedAlert.email_status}', attempts: ${failedAlert.email_attempts}, last_error: '${failedAlert.email_last_error}'`);

        if (failedAlert.email_status !== "FAILED" || failedAlert.email_attempts !== 1) {
            throw new Error(`Test 2 FAILED: Expected email_status='FAILED' and attempts=1, got ${failedAlert.email_status} / ${failedAlert.email_attempts}`);
        }

        const failureAuditRes = await pool.query(
            "SELECT * FROM audit_logs WHERE evidence_id = $1 AND action = 'EMAIL_ALERT_FAILED' ORDER BY audit_id DESC LIMIT 1;",
            [TEST_EVIDENCE_ID]
        );
        if (failureAuditRes.rows.length === 0) {
            throw new Error("Test 2 FAILED: Expected EMAIL_ALERT_FAILED entry in audit_logs, none found.");
        }
        console.log(`[Test 2] Audit log recorded: ${failureAuditRes.rows[0].action} - ${failureAuditRes.rows[0].details}`);

        emailService.sendTamperAlertEmail = originalSendEmail;
        console.log("[Test 2] Restored working email transport. Triggering retry via next scan...");

        const scanRecover = await alertService.scanAllEvidenceIntegrity();
        console.log(`[Test 2] Recovery scan finished.`);

        const recoveredAlertRes = await pool.query(
            "SELECT * FROM tamper_alerts WHERE evidence_id = $1 AND status = 'ACTIVE';",
            [TEST_EVIDENCE_ID]
        );
        const recoveredAlert = recoveredAlertRes.rows[0];
        console.log(`[Test 2] Alert state after retry: email_status: '${recoveredAlert.email_status}', attempts: ${recoveredAlert.email_attempts}, sent_at: ${recoveredAlert.email_sent_at}`);

        if (recoveredAlert.email_status !== "SENT" || recoveredAlert.email_attempts !== 2) {
            throw new Error(`Test 2 FAILED: Expected email_status='SENT' and attempts=2, got ${recoveredAlert.email_status} / ${recoveredAlert.email_attempts}`);
        }

        const successAuditRes = await pool.query(
            "SELECT * FROM audit_logs WHERE evidence_id = $1 AND action = 'EMAIL_ALERT_SENT' ORDER BY audit_id DESC LIMIT 1;",
            [TEST_EVIDENCE_ID]
        );
        if (successAuditRes.rows.length === 0) {
            throw new Error("Test 2 FAILED: Expected EMAIL_ALERT_SENT entry in audit_logs, none found.");
        }
        console.log(`[Test 2] Audit log recorded: ${successAuditRes.rows[0].action} - ${successAuditRes.rows[0].details}`);

        console.log(">>> [PASS] TEST 2: Forced SMTP failure retried and recovered to SENT.\n");
        await cleanActiveAlertsForExhibit(TEST_EVIDENCE_ID);

        // =========================================================================
        // TEST 3: Two overlapping scans create one alert (mutex guard)
        // =========================================================================
        console.log("--------------------------------------------------------------------------------");
        console.log("TEST 3: Two overlapping scans create one alert (mutex guard)");
        console.log("--------------------------------------------------------------------------------");

        fs.writeFileSync(encFilePath, tamperedBytes);

        console.log("[Test 3] Triggering two concurrent scans via Promise.all()...");
        const [concurrentRes1, concurrentRes2] = await Promise.all([
            alertService.scanAllEvidenceIntegrity(),
            alertService.scanAllEvidenceIntegrity()
        ]);

        console.log(`[Test 3] Concurrent Run 1 result: already_running=${concurrentRes1.already_running || false}, new_alerts=${concurrentRes1.new_alerts_dispatched || 0}`);
        console.log(`[Test 3] Concurrent Run 2 result: already_running=${concurrentRes2.already_running || false}, new_alerts=${concurrentRes2.new_alerts_dispatched || 0}`);

        const oneWasBlocked = concurrentRes1.already_running || concurrentRes2.already_running;
        if (!oneWasBlocked) {
            throw new Error("Test 3 FAILED: Neither concurrent scan reported already_running=true! Mutex failed.");
        }

        const mutexAlertRes = await pool.query(
            "SELECT * FROM tamper_alerts WHERE evidence_id = $1 AND status = 'ACTIVE';",
            [TEST_EVIDENCE_ID]
        );
        if (mutexAlertRes.rows.length !== 1) {
            throw new Error(`Test 3 FAILED: Expected exactly 1 active alert from concurrent scans, found ${mutexAlertRes.rows.length}`);
        }

        console.log(`[Test 3] Active alert count in DB: ${mutexAlertRes.rows.length} (Alert ID #${mutexAlertRes.rows[0].alert_id})`);
        console.log(">>> [PASS] TEST 3: Overlapping scans blocked cleanly by mutex guard and exactly 1 alert created.\n");

    } finally {
        console.log("--------------------------------------------------------------------------------");
        console.log("CLEANUP & RESTORATION");
        console.log("--------------------------------------------------------------------------------");
        fs.copyFileSync(backupFilePath, encFilePath);
        const restoredBytes = fs.readFileSync(encFilePath);
        const restoredHash = crypto.createHash("sha256").update(restoredBytes).digest("hex");
        console.log(`[Cleanup] Restored file size: ${restoredBytes.length} bytes`);
        console.log(`[Cleanup] Restored hash:      ${restoredHash}`);
        console.log(`[Cleanup] Intact match:       ${restoredHash === originalHash ? "YES (BIT-FOR-BIT MATCH)" : "NO"}`);

        const finalCheck = await alertService.checkEvidenceIntegrity(testExhibit);
        console.log(`[Cleanup] Post-restore integrity check: ${finalCheck.status}`);

        await cleanActiveAlertsForExhibit(TEST_EVIDENCE_ID);
        console.log("[Cleanup] Resolved test alerts for exhibit in DB.");

        try { fs.unlinkSync(backupFilePath); } catch (_) {}
        delete process.env.DEMO_MAIL;
        console.log("[Cleanup] Temporary backups removed.\n");
    }

    console.log("================================================================================");
    console.log("   ALL THREE INTEGRITY MONITOR HARDENING TESTS PASSED SUCCESSFULLY!             ");
    console.log("================================================================================\n");
}

if (require.main === module) {
    runHardeningVerification()
        .then(() => {
            pool.end();
            process.exit(0);
        })
        .catch(err => {
            console.error("\nTEST SUITE FAILED WITH ERROR:", err.message);
            pool.end();
            process.exit(1);
        });
}

module.exports = { runHardeningVerification };
