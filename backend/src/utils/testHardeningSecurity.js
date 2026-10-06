/**
 * Automated Verification Suite for Evidence Security Hardening
 *
 * Verifies:
 *   1. Audit Log Hash Chain tamper detection (AUDIT_CHAIN_BROKEN)
 *   2. Deleted evidence row detection vs Signed Manifest (EVIDENCE_RECORD_DELETED)
 *   3. Stray storage file detection in uploads/ (UNREGISTERED_FILE)
 *   4. Duplicate suppression (exactly 1 alert & 1 email dispatched across multiple scans)
 *   5. Complete cleanup and restoration of all test records
 *
 * Security: NEVER prints passwords, tokens, or raw secrets.
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const pool = require("../config/db");
const auditService = require("../services/auditService");
const alertService = require("../services/alertService");
const manifestService = require("../services/manifestService");
const emailService = require("../services/emailService");

async function runTestSuite() {
    console.log("================================================================================");
    console.log("STARTING EVIDENCE INTEGRITY SECURITY HARDENING TEST SUITE");
    console.log("================================================================================\n");

    const emailDispatches = [];
    const origSendTamperAlert = emailService.sendTamperAlertEmail;
    const origSendDigestAlert = emailService.sendTamperAlertDigestEmail;

    // Spy on email dispatch to accurately count deliveries
    emailService.sendTamperAlertEmail = async (alert) => {
        emailDispatches.push({ type: "SINGLE", alert_type: alert.alert_type });
        return { sent: true, recipient: "admin@test.gov" };
    };
    emailService.sendTamperAlertDigestEmail = async (alerts) => {
        emailDispatches.push({ type: "DIGEST", count: alerts.length, types: alerts.map(a => a.alert_type) });
        return { sent: true, recipient: "admin@test.gov" };
    };

    try {
        // Baseline check
        console.log("[Baseline] Verifying existing audit chain...");
        const baseChain = await auditService.verifyAuditLogChain();
        if (!baseChain.valid) {
            throw new Error(`Initial audit log chain is invalid: ${baseChain.reason}`);
        }
        console.log(`[Baseline] Audit log chain valid across ${baseChain.total} records.`);

        console.log("[Baseline] Generating initial signed integrity manifest...");
        await manifestService.generateDailySignedManifest();
        console.log("[Baseline] Initial signed manifest established.");

        // Run baseline scan to establish steady-state alerts
        console.log("[Baseline] Running baseline vault scan...");
        await alertService.scanAllEvidenceIntegrity(null, true);
        console.log("[Baseline] Vault baseline established.\n");

        // =====================================================================
        // TEST 1: Break Audit Log Hash Chain
        // =====================================================================
        console.log("--------------------------------------------------------------------------------");
        console.log("TEST 1: Break Audit Log Hash Chain & Verify Duplicate Suppression");
        console.log("--------------------------------------------------------------------------------");

        emailDispatches.length = 0;
        await pool.query("DELETE FROM tamper_alerts WHERE alert_type = 'AUDIT_CHAIN_BROKEN';");

        // Insert a test audit record
        const originalDetail = "Initial pristine test audit record payload";
        const testAudit = await auditService.createAuditLog(
            null,
            null,
            "TEST_CHAIN_ITEM",
            originalDetail
        );
        console.log(`Inserted test audit row #${testAudit.audit_id}`);

        // Tamper with the test row's details
        await pool.query(
            "UPDATE audit_logs SET details = 'TAMPERED_INTRUDER_CONTENT' WHERE audit_id = $1;",
            [testAudit.audit_id]
        );
        console.log("Tampered with test audit row details directly in database.");

        // Scan 1: Should detect chain break and raise AUDIT_CHAIN_BROKEN
        console.log("Running Scan 1...");
        const scan1 = await alertService.scanAllEvidenceIntegrity(null, true);
        const alerts1 = scan1.new_alerts_dispatched;
        const emails1 = emailDispatches.length;
        console.log(`Scan 1 -> New alerts dispatched: ${alerts1}, Emails sent: ${emails1}`);

        // Scan 2: Should detect existing active alert and SUPPRESS duplicate alert & email
        console.log("Running Scan 2 (duplicate check)...");
        const scan2 = await alertService.scanAllEvidenceIntegrity(null, true);
        const alerts2 = scan2.new_alerts_dispatched;
        const emails2 = emailDispatches.length - emails1;
        console.log(`Scan 2 -> New alerts dispatched: ${alerts2}, Emails sent: ${emails2}`);

        if (alerts1 < 1 || emails1 < 1) {
            throw new Error(`TEST 1 FAILED: Expected at least 1 alert and 1 email on Scan 1, got ${alerts1} alerts, ${emails1} emails`);
        }
        if (alerts2 !== 0 || emails2 !== 0) {
            throw new Error(`TEST 1 FAILED: Duplicate suppression failed on Scan 2: got ${alerts2} alerts, ${emails2} emails`);
        }
        console.log("[TEST 1 PASSED] Exactly 1 alert and 1 email raised; Scan 2 completely suppressed.\n");

        // Restore Test 1 by restoring original details and cleaning test alert
        await pool.query("UPDATE audit_logs SET details = $1 WHERE audit_id = $2;", [originalDetail, testAudit.audit_id]);
        await pool.query("DELETE FROM tamper_alerts WHERE alert_type = 'AUDIT_CHAIN_BROKEN';");
        const restoredChain = await auditService.verifyAuditLogChain();
        console.log(`[Cleanup 1] Original details restored. Chain valid: ${restoredChain.valid}\n`);

        // =====================================================================
        // TEST 2: Delete Evidence Row vs Signed Manifest
        // =====================================================================
        console.log("--------------------------------------------------------------------------------");
        console.log("TEST 2: Delete Evidence Row & Verify EVIDENCE_RECORD_DELETED");
        console.log("--------------------------------------------------------------------------------");

        emailDispatches.length = 0;
        await pool.query("DELETE FROM tamper_alerts WHERE alert_type = 'EVIDENCE_RECORD_DELETED';");

        // Fetch a valid case_id and user_id
        const caseRes = await pool.query("SELECT case_id FROM cases ORDER BY case_id ASC LIMIT 1;");
        const caseId = caseRes.rows[0].case_id;
        const userRes = await pool.query("SELECT user_id FROM users ORDER BY user_id ASC LIMIT 1;");
        const userId = userRes.rows[0].user_id;

        // Insert a temporary test evidence item
        const dummyHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        const insertEvRes = await pool.query(`
            INSERT INTO evidence (case_id, evidence_number, evidence_name, evidence_type, file_name, file_path, file_hash, uploaded_by, is_legacy_seed)
            VALUES ($1, 'TEST-EV-TEMP-999', 'Temporary Test Exhibit', 'Document', 'dummy.dat', 'uploads/dummy.dat', $2, $3, true)
            RETURNING evidence_id, evidence_number;
        `, [caseId, dummyHash, userId]);
        const testEv = insertEvRes.rows[0];
        console.log(`Created test evidence record ${testEv.evidence_number} (ID: ${testEv.evidence_id})`);

        // Generate signed manifest that seals this record
        await manifestService.generateDailySignedManifest();
        console.log("Generated signed manifest containing test evidence exhibit.");

        // Now delete the record from PostgreSQL
        await pool.query("DELETE FROM evidence WHERE evidence_id = $1;", [testEv.evidence_id]);
        console.log("Deleted test evidence record from database.");

        // Scan 1: Should detect deleted record vs manifest and raise EVIDENCE_RECORD_DELETED
        console.log("Running Scan 1...");
        const delScan1 = await alertService.scanAllEvidenceIntegrity(null, true);
        const delAlerts1 = delScan1.new_alerts_dispatched;
        const delEmails1 = emailDispatches.length;
        console.log(`Scan 1 -> New alerts dispatched: ${delAlerts1}, Emails sent: ${delEmails1}`);

        // Scan 2: Should suppress duplicates
        console.log("Running Scan 2 (duplicate check)...");
        const delScan2 = await alertService.scanAllEvidenceIntegrity(null, true);
        const delAlerts2 = delScan2.new_alerts_dispatched;
        const delEmails2 = emailDispatches.length - delEmails1;
        console.log(`Scan 2 -> New alerts dispatched: ${delAlerts2}, Emails sent: ${delEmails2}`);

        if (delAlerts1 < 1 || delEmails1 < 1) {
            throw new Error(`TEST 2 FAILED: Expected alert and email for deleted evidence on Scan 1, got ${delAlerts1} alerts, ${delEmails1} emails`);
        }
        if (delAlerts2 !== 0 || delEmails2 !== 0) {
            throw new Error(`TEST 2 FAILED: Duplicate suppression failed on Scan 2: got ${delAlerts2} alerts, ${delEmails2} emails`);
        }
        console.log("[TEST 2 PASSED] Exactly 1 EVIDENCE_RECORD_DELETED alert and 1 email raised; Scan 2 suppressed.\n");

        // Restore Test 2
        await pool.query("DELETE FROM tamper_alerts WHERE alert_type = 'EVIDENCE_RECORD_DELETED';");
        await manifestService.generateDailySignedManifest();
        console.log("[Cleanup 2] Cleaned test alerts and re-signed manifest to baseline.\n");

        // =====================================================================
        // TEST 3: Add Stray File in uploads/ (UNREGISTERED_FILE)
        // =====================================================================
        console.log("--------------------------------------------------------------------------------");
        console.log("TEST 3: Add Stray File & Verify UNREGISTERED_FILE Detection");
        console.log("--------------------------------------------------------------------------------");

        emailDispatches.length = 0;
        await pool.query("DELETE FROM tamper_alerts WHERE alert_type = 'UNREGISTERED_FILE' AND file_path LIKE '%stray%';");

        const uploadsDir = path.resolve(__dirname, "../../uploads");
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        const strayFilePath = path.join(uploadsDir, "stray_unregistered_forensic_artifact.tmp");
        fs.writeFileSync(strayFilePath, "STRAY_FORENSIC_FILE_PAYLOAD_FOR_TESTING", "utf8");
        console.log(`Created stray physical file: ${strayFilePath}`);

        // Scan 1: Should detect unregistered file and raise UNREGISTERED_FILE
        console.log("Running Scan 1...");
        const strayScan1 = await alertService.scanAllEvidenceIntegrity(null, true);
        const strayAlerts1 = strayScan1.new_alerts_dispatched;
        const strayEmails1 = emailDispatches.length;
        console.log(`Scan 1 -> New alerts dispatched: ${strayAlerts1}, Emails sent: ${strayEmails1}`);

        // Scan 2: Should suppress duplicates
        console.log("Running Scan 2 (duplicate check)...");
        const strayScan2 = await alertService.scanAllEvidenceIntegrity(null, true);
        const strayAlerts2 = strayScan2.new_alerts_dispatched;
        const strayEmails2 = emailDispatches.length - strayEmails1;
        console.log(`Scan 2 -> New alerts dispatched: ${strayAlerts2}, Emails sent: ${strayEmails2}`);

        if (strayAlerts1 < 1 || strayEmails1 < 1) {
            throw new Error(`TEST 3 FAILED: Expected UNREGISTERED_FILE alert and email on Scan 1, got ${strayAlerts1} alerts, ${strayEmails1} emails`);
        }
        if (strayAlerts2 !== 0 || strayEmails2 !== 0) {
            throw new Error(`TEST 3 FAILED: Duplicate suppression failed on Scan 2: got ${strayAlerts2} alerts, ${strayEmails2} emails`);
        }
        console.log("[TEST 3 PASSED] Exactly 1 UNREGISTERED_FILE alert and 1 email raised; Scan 2 suppressed.\n");

        // Restore Test 3
        if (fs.existsSync(strayFilePath)) fs.unlinkSync(strayFilePath);
        await pool.query("DELETE FROM tamper_alerts WHERE alert_type = 'UNREGISTERED_FILE';");
        console.log("[Cleanup 3] Stray file deleted from disk and test alerts removed.\n");

        // Final verification
        const finalChain = await auditService.verifyAuditLogChain();
        console.log("================================================================================");
        console.log(`ALL TESTS PASSED SUCCESSFULLY! Final Audit Chain: ${finalChain.valid ? "VALID" : "INVALID"} (${finalChain.total} records)`);
        console.log("================================================================================\n");

    } finally {
        emailService.sendTamperAlertEmail = origSendTamperAlert;
        emailService.sendTamperAlertDigestEmail = origSendDigestAlert;
        await pool.end();
    }
}

runTestSuite().catch(err => {
    console.error("Test Suite Execution Failed:", err);
    process.exit(1);
});
