/**
 * =============================================================================
 * DIG_EVI — Safe Tamper Alert Email Notification Tester
 * =============================================================================
 *
 * This test script verifies email dispatching without altering real evidence
 * or modifying production records in PostgreSQL.
 *
 * Usage:
 *   node src/utils/testEmailNotification.js
 *
 * Behavior:
 * 1. If SMTP credentials exist in .env:
 *    - Verifies connection to the configured SMTP server.
 *    - Sends a simulated tamper alert to the configured recipient.
 * 2. If SMTP credentials are NOT yet configured in .env:
 *    - Automatically creates a temporary Ethereal test account.
 *    - Sends a simulated tamper alert to Ethereal.
 *    - Prints an instant web preview URL to inspect the rendered email!
 * =============================================================================
 */

require("dotenv").config();
const nodemailer = require("nodemailer");
const emailService = require("../services/emailService");

async function runEmailTest() {
    console.log("================================================================================");
    console.log("       DIG_EVI — Safe Tamper Alert Email Notification Verification       ");
    console.log("================================================================================\n");

    const isConfigured = emailService.isSmtpConfigured();
    console.log(`[Status] SMTP Configured in .env: ${isConfigured ? "YES" : "NO"}`);

    if (isConfigured) {
        console.log(`[Config] Host: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}`);
        console.log(`[Config] User: ${process.env.SMTP_USER}`);

        const recipient = await emailService.resolveRecipientEmail();
        console.log(`[Config] Target Recipient: ${recipient || "(None resolved)"}`);

        console.log("\n[1/2] Verifying SMTP credentials and handshake...");
        const conn = await emailService.verifySmtpConnection();
        if (!conn.connected) {
            console.error(`[Error] SMTP Connection Failed: ${conn.error}`);
            console.log("\nPlease check your SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in backend/.env.");
            return;
        }
        console.log("      SMTP Server Handshake: SUCCESSFUL (Ready to send)");

        console.log("\n[2/2] Sending simulated tamper alert email...");
        const simulatedAlert = {
            alert_id: 9999,
            case_id: 1,
            case_number: "CASE-2026-TEST",
            evidence_id: 999,
            evidence_number: "EVI-TEST-001",
            evidence_name: "Simulated Test Mobile Exhibit.dd",
            alert_type: "HASH_MISMATCH",
            severity: "CRITICAL",
            detected_at: new Date(),
            stored_hash: "a35f79b69b07198a2879ef7f900a6c6c4297127e77a28e7e174bceef1ec48921",
            detected_hash: "e5b721d98a0234f9a128cf7e800c1d1d3182619f66b17e6e063adeef0db37810",
            file_path: "uploads/encrypted/test-exhibit.bin",
            message: "Simulated verification failure: SHA-256 hash mismatch detected during scheduled audit."
        };

        const result = await emailService.sendTamperAlertEmail(simulatedAlert);
        if (result.sent) {
            console.log(`\n>>> SUCCESS: Tamper alert email dispatched successfully!`);
            console.log(`    Message ID: ${result.messageId}`);
            console.log(`    Recipient:  ${result.recipient}`);
        } else {
            console.error(`\n>>> FAILED: ${result.error || result.reason}`);
        }
    } else {
        console.log("\n[Notice] SMTP credentials are not yet set in backend/.env.");
        console.log("[Test Mode] Generating a temporary Ethereal test inbox for immediate verification...\n");

        try {
            const testAccount = await nodemailer.createTestAccount();
            console.log(`[Ethereal] Temporary Test Account Created: ${testAccount.user}`);

            const testTransporter = nodemailer.createTransport({
                host: testAccount.smtp.host,
                port: testAccount.smtp.port,
                secure: testAccount.smtp.secure,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass
                }
            });

            const simulatedAlert = {
                alert_id: 9999,
                case_id: 1,
                case_number: "CASE-2026-TEST",
                evidence_id: 999,
                evidence_number: "EVI-TEST-001",
                evidence_name: "Simulated Test Disk Image.raw",
                alert_type: "HASH_MISMATCH",
                severity: "CRITICAL",
                detected_at: new Date(),
                stored_hash: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
                detected_hash: "d7a8fbb307d7809469ca933b02b1f18f075ba887016491ea40bea39a435193ac",
                file_path: "uploads/encrypted/test-disk-image.bin",
                message: "Simulated test alert: Hash mismatch detected during integrity sweep."
            };

            const recipient = "admin.test@police.gov.in";
            const detectionTime = new Date().toUTCString();

            const textContent = `
================================================================================
DIG_EVI DIGITAL EVIDENCE MANAGEMENT SYSTEM — CRITICAL INTEGRITY ALERT
================================================================================
Alert ID:            #${simulatedAlert.alert_id}
Case Reference:      ${simulatedAlert.case_number}
Evidence Number:     ${simulatedAlert.evidence_number}
Evidence Name:       ${simulatedAlert.evidence_name}
Integrity Failure:   ${simulatedAlert.alert_type}
Severity Level:      ${simulatedAlert.severity}
Detection Time:      ${detectionTime}
Stored SHA-256 Hash: ${simulatedAlert.stored_hash}
Detected SHA-256:    ${simulatedAlert.detected_hash}
Diagnostic Message:  ${simulatedAlert.message}

ACTION REQUIRED: Open DIG_EVI Alert Center immediately to investigate.
================================================================================
            `.trim();

            const htmlContent = `
            <div style="font-family: Arial, sans-serif; padding: 20px; background: #f8fafc;">
                <div style="max-width: 600px; margin: 0 auto; background: white; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
                    <div style="background: #b91c1c; color: white; padding: 18px 24px;">
                        <h2 style="margin: 0; font-size: 18px;">🚨 [DIG_EVI] CRITICAL DIGITAL EVIDENCE INTEGRITY ALERT</h2>
                        <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.9;">Automated Sentinel Integrity Monitor</p>
                    </div>
                    <div style="padding: 24px;">
                        <p>A critical integrity anomaly has been detected on an encrypted digital exhibit.</p>
                        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px; font-weight: bold;">Alert ID</td><td style="padding: 8px;">#${simulatedAlert.alert_id}</td></tr>
                            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px; font-weight: bold;">Case</td><td style="padding: 8px;">${simulatedAlert.case_number}</td></tr>
                            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px; font-weight: bold;">Evidence Exhibit</td><td style="padding: 8px;">${simulatedAlert.evidence_number} (${simulatedAlert.evidence_name})</td></tr>
                            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px; font-weight: bold;">Failure Type</td><td style="padding: 8px; color: #b91c1c; font-weight: bold;">${simulatedAlert.alert_type}</td></tr>
                            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px; font-weight: bold;">Stored Hash</td><td style="padding: 8px; font-family: monospace; font-size: 11px;">${simulatedAlert.stored_hash}</td></tr>
                            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px; font-weight: bold;">Detected Hash</td><td style="padding: 8px; font-family: monospace; font-size: 11px;">${simulatedAlert.detected_hash}</td></tr>
                        </table>
                        <div style="margin-top: 20px; padding: 12px; background: #fffbeb; border-left: 4px solid #f59e0b; font-size: 12px; color: #92400e;">
                            <strong>ACTION REQUIRED:</strong> Access the DIG_EVI Alert Center dashboard to investigate this incident.
                        </div>
                    </div>
                </div>
            </div>`;

            const info = await testTransporter.sendMail({
                from: '"DIG_EVI Sentinel Alert" <sentinel@dig-evi.local>',
                to: recipient,
                subject: "[DIG_EVI] CRITICAL DIGITAL EVIDENCE INTEGRITY ALERT",
                text: textContent,
                html: htmlContent
            });

            console.log(`[Success] Test email generated and sent! (Message ID: ${info.messageId})`);
            const previewUrl = nodemailer.getTestMessageUrl(info);
            console.log("\n================================================================================");
            console.log(">>> VIEW THE RENDERED EMAIL PREVIEW HERE:");
            console.log(`    ${previewUrl}`);
            console.log("================================================================================");
            console.log("\nTo send real emails to your inbox:");
            console.log("1. Open backend/.env");
            console.log("2. Set SMTP_HOST=smtp.gmail.com (or your mail server)");
            console.log("3. Set SMTP_PORT=587");
            console.log("4. Set SMTP_USER=your_email@gmail.com");
            console.log("5. Set SMTP_PASS=your_gmail_app_password");
            console.log("6. Set SYSTEM_ADMIN_EMAIL=your_email@gmail.com");
            console.log("7. Run this test script again.");
        } catch (err) {
            console.error("[Test Error] Ethereal test failed:", err.message);
        }
    }
}

if (require.main === module) {
    runEmailTest().then(() => {
        process.exit(0);
    }).catch(err => {
        console.error("Test execution failed:", err);
        process.exit(1);
    });
}

module.exports = { runEmailTest };

