const nodemailer = require("nodemailer");
const pool = require("../config/db");

/**
 * Checks whether SMTP environment variables are properly populated.
 */
const isSmtpConfigured = () => {
    const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
    return Boolean(
        SMTP_HOST && SMTP_HOST.trim() &&
        SMTP_USER && SMTP_USER.trim() &&
        SMTP_PASS && SMTP_PASS.trim()
    );
};

let cachedTransporter = null;
let cachedEtherealTransporter = null;

/**
 * Creates or retrieves the cached Nodemailer transporter instance.
 */
const getTransporter = async (forceEthereal = false) => {
    if (isSmtpConfigured() && !forceEthereal) {
        if (!cachedTransporter) {
            const port = parseInt(process.env.SMTP_PORT, 10) || 587;
            const isSecure = port === 465;

            cachedTransporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST.trim(),
                port: port,
                secure: isSecure,
                auth: {
                    user: process.env.SMTP_USER.trim(),
                    pass: process.env.SMTP_PASS.trim()
                },
                connectionTimeout: 10000,
                greetingTimeout: 10000,
                socketTimeout: 15000
            });
        }
        return { transporter: cachedTransporter, isEthereal: false };
    }

    if (process.env.ENABLE_ETHEREAL_DEMO === "true" || forceEthereal) {
        if (!cachedEtherealTransporter) {
            console.log("[EmailService] Initializing Ethereal demo mail transport for safe testing...");
            const testAccount = await nodemailer.createTestAccount();
            console.log(`[EmailService] Ethereal demo inbox created for: ${testAccount.user}`);
            cachedEtherealTransporter = nodemailer.createTransport({
                host: testAccount.smtp.host,
                port: testAccount.smtp.port,
                secure: testAccount.smtp.secure,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass
                }
            });
        }
        return { transporter: cachedEtherealTransporter, isEthereal: true };
    }

    return { transporter: null, isEthereal: false };
};

/**
 * Resolves the destination email address for System Administrator alerts.
 * Priority:
 * 1. SYSTEM_ADMIN_EMAIL from environment variables
 * 2. Active System Administrator (role_id = 1) email from database users table
 */
const resolveRecipientEmail = async () => {
    if (process.env.SYSTEM_ADMIN_EMAIL && process.env.SYSTEM_ADMIN_EMAIL.trim()) {
        return process.env.SYSTEM_ADMIN_EMAIL.trim();
    }

    try {
        const query = `
            SELECT email, full_name 
            FROM users 
            WHERE role_id = 1 AND is_active = TRUE AND email IS NOT NULL AND email != ''
            ORDER BY user_id ASC 
            LIMIT 1;
        `;
        const res = await pool.query(query);
        if (res.rows.length > 0 && res.rows[0].email) {
            return res.rows[0].email.trim();
        }
    } catch (dbErr) {
        console.warn("[EmailService] Failed to query admin email from database:", dbErr.message);
    }

    return null;
};

/**
 * Dispatches a high-priority tamper alert notification email to the System Administrator.
 *
 * @param {Object} alertDetails Details of the newly created tamper alert
 * @returns {Promise<Object>} Status object with send result
 */
const sendTamperAlertEmail = async (alertDetails, options = {}) => {
    try {
        const forceEthereal = Boolean(options.useEthereal);
        const { transporter, isEthereal } = await getTransporter(forceEthereal);
        if (!transporter) {
            console.log("[EmailService] SMTP email notifications are not configured.");
            return { sent: false, reason: "SMTP_NOT_CONFIGURED" };
        }

        const resolved = await resolveRecipientEmail();
        const recipient = resolved || (isEthereal ? "admin.sentinel@dig-evi.local" : null);
        if (!recipient) {
            console.warn("[EmailService] No recipient email address available for tamper alert. Set SYSTEM_ADMIN_EMAIL in .env or configure an active System Administrator email in the database.");
            return { sent: false, reason: "NO_RECIPIENT_EMAIL" };
        }

        const {
            alert_id,
            case_id,
            case_number,
            evidence_id,
            evidence_number,
            evidence_name,
            alert_type,
            severity,
            detected_at,
            stored_hash,
            detected_hash,
            file_path,
            message
        } = alertDetails || {};

        const detectionTime = detected_at
            ? new Date(detected_at).toLocaleString("en-US", { timeZone: "UTC", dateStyle: "full", timeStyle: "long" }) + " (UTC)"
            : new Date().toISOString() + " (UTC)";

        const subject = "[DIG_EVI] CRITICAL DIGITAL EVIDENCE INTEGRITY ALERT";

        const textContent = `
================================================================================
DIG_EVI DIGITAL EVIDENCE MANAGEMENT SYSTEM — CRITICAL INTEGRITY ALERT
================================================================================

ATTENTION: System Administrator

A critical digital evidence tamper or integrity anomaly has been detected
by the DIG_EVI automated integrity monitoring system.

INCIDENT DETAILS:
--------------------------------------------------------------------------------
Alert Reference ID:  #${alert_id || "NEW"}
Case ID:             ${case_id || "N/A"}${case_number ? ` (Case #${case_number})` : ""}
Evidence ID:         ${evidence_id || "N/A"}
Evidence Number:     ${evidence_number || "N/A"}
Evidence Name:       ${evidence_name || "N/A"}
Integrity Failure:   ${alert_type || "TAMPER_DETECTED"}
Severity Level:      ${severity || "CRITICAL"}
Detection Time:      ${detectionTime}
Stored SHA-256 Hash: ${stored_hash || "Not Available"}
Detected SHA-256:    ${detected_hash || "Not Available"}
Storage Path:        ${file_path || "N/A"}
Diagnostic Message:  ${message || "Evidence integrity verification failed."}

--------------------------------------------------------------------------------
ACTION REQUIRED:
Please open the DIG_EVI Alert Center immediately to review this incident,
inspect chain of custody logs, audit system events, and initiate the formal
evidence compromise response procedure.

System: DIG_EVI Digital Evidence Chain of Custody & Management System
Sentinel Background Automated Integrity Monitor
================================================================================
`.trim();

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }
    .container { max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #cbd5e1; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .header { background: #b91c1c; color: #ffffff; padding: 20px 24px; }
    .header h1 { margin: 0; font-size: 19px; font-weight: 700; letter-spacing: 0.3px; }
    .header p { margin: 6px 0 0 0; font-size: 13px; opacity: 0.92; }
    .body { padding: 24px; }
    .lead { font-size: 14.5px; line-height: 1.55; margin-bottom: 20px; color: #334155; }
    .alert-card { background: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #dc2626; padding: 12px 16px; border-radius: 4px; margin-bottom: 22px; font-size: 14px; font-weight: bold; color: #991b1b; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th, td { text-align: left; padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #e2e8f0; }
    th { width: 34%; background: #f8fafc; color: #475569; font-weight: 600; }
    td { width: 66%; color: #0f172a; word-break: break-all; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; }
    .cta-box { background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; padding: 14px 18px; border-radius: 4px; font-size: 13.5px; line-height: 1.5; color: #92400e; margin-bottom: 20px; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; font-size: 11.5px; color: #64748b; text-align: center; line-height: 1.4; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚨 CRITICAL DIGITAL EVIDENCE INTEGRITY ALERT</h1>
      <p>DIG_EVI Digital Evidence Chain of Custody &amp; Management System</p>
    </div>
    <div class="body">
      <p class="lead">
        A critical digital evidence integrity anomaly was detected by the automated cryptographic background monitoring system. Immediate administrative attention is recommended.
      </p>
      <div class="alert-card">
        FAILURE CLASSIFICATION: ${alert_type || "TAMPER_DETECTED"} (${severity || "CRITICAL"})
      </div>
      <table>
        <tr><th>Alert Reference</th><td>#${alert_id || "NEW"}</td></tr>
        <tr><th>Case ID</th><td>Case ID ${case_id || "N/A"}${case_number ? ` (${case_number})` : ""}</td></tr>
        <tr><th>Evidence ID</th><td>${evidence_id || "N/A"}</td></tr>
        <tr><th>Evidence Number</th><td class="mono"><strong>${evidence_number || "N/A"}</strong></td></tr>
        <tr><th>Evidence Name</th><td>${evidence_name || "N/A"}</td></tr>
        <tr><th>Integrity Failure</th><td style="color: #b91c1c; font-weight: bold;">${alert_type || "TAMPER_DETECTED"}</td></tr>
        <tr><th>Detection Timestamp</th><td>${detectionTime}</td></tr>
        <tr><th>Stored SHA-256 Hash</th><td class="mono">${stored_hash || "Not Available"}</td></tr>
        <tr><th>Detected SHA-256 Hash</th><td class="mono">${detected_hash || "Not Available"}</td></tr>
        <tr><th>Storage Path</th><td class="mono">${file_path || "N/A"}</td></tr>
        <tr><th>Diagnostic Detail</th><td>${message || "Evidence integrity verification failed."}</td></tr>
      </table>
      <div class="cta-box">
        <strong>ACTION REQUIRED:</strong> Please log in to the DIG_EVI system, open the <strong>Alert Center</strong> dashboard, inspect the evidence exhibits and chain of custody logs, and follow the standard evidence compromise response protocols.
      </div>
    </div>
    <div class="footer">
      Automated System Notification &bull; DIG_EVI Sentinel Integrity Monitor &bull; Confidential Administrative Record
    </div>
  </div>
</body>
</html>
`;

        const fromAddress = process.env.SMTP_FROM || `"DIG_EVI Sentinel Alert" <${process.env.SMTP_USER || "sentinel@dig-evi.local"}>`;

        const sendResult = await transporter.sendMail({
            from: fromAddress,
            to: recipient,
            subject: subject,
            text: textContent,
            html: htmlContent
        });

        const previewUrl = isEthereal ? nodemailer.getTestMessageUrl(sendResult) : null;
        if (previewUrl) {
            console.log(`[EmailService] >>> Ethereal demo email preview URL: ${previewUrl}`);
        } else {
            console.log(`[EmailService] Tamper alert notification successfully sent to ${recipient} (Message ID: ${sendResult.messageId})`);
        }

        return {
            sent: true,
            messageId: sendResult.messageId,
            recipient: recipient,
            previewUrl: previewUrl,
            subject: subject,
            text: textContent
        };
    } catch (err) {
        console.error("[EmailService] Failed to send tamper alert email (non-fatal):", err.message);
        return {
            sent: false,
            error: err.message
        };
    }
};

/**
 * Helper to verify SMTP credentials and connectivity during manual testing.
 */
const verifySmtpConnection = async () => {
    const { transporter, isEthereal } = await getTransporter();
    if (!transporter) {
        return {
            configured: false,
            message: "SMTP credentials are not configured in environment variables."
        };
    }
    try {
        await transporter.verify();
        return {
            configured: true,
            connected: true,
            isEthereal: isEthereal,
            message: isEthereal ? "Ethereal demo mail transporter active." : "SMTP connection verified successfully."
        };
    } catch (err) {
        return {
            configured: true,
            connected: false,
            error: err.message
        };
    }
};

module.exports = {
    isSmtpConfigured,
    getTransporter,
    resolveRecipientEmail,
    sendTamperAlertEmail,
    verifySmtpConnection
};

