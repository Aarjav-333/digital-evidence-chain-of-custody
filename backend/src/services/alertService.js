const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const pool = require("../config/db");
const alertModel = require("../models/alertModel");
const auditService = require("./auditService");
const emailService = require("./emailService");
const { decryptAESKey } = require("../utils/encryption");

// Global mutex to prevent concurrent integrity scans
let isScanRunning = false;

const getIsScanRunning = () => isScanRunning;

/**
 * Streams unencrypted file bytes directly through SHA-256 without loading into memory buffer.
 */
const streamComputeFileSha256 = (filePath) => {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash("sha256");
        const stream = fs.createReadStream(filePath);
        stream.on("data", chunk => hash.update(chunk));
        stream.on("end", () => resolve(hash.digest("hex")));
        stream.on("error", reject);
    });
};

/**
 * Streams AES-256-GCM ciphertext from disk, decrypts on the fly, and feeds decrypted chunks
 * directly into SHA-256 digest without buffering plaintext.
 * Throws on GCM authentication failure (tampered ciphertext / auth tag).
 */
const streamDecryptAndHash = (filePath, fileKeyBuffer, ivBuffer, authTagBuffer) => {
    return new Promise((resolve, reject) => {
        let decipher;
        try {
            decipher = crypto.createDecipheriv("aes-256-gcm", fileKeyBuffer, ivBuffer);
            decipher.setAuthTag(authTagBuffer);
        } catch (initErr) {
            return reject(initErr);
        }

        const hash = crypto.createHash("sha256");
        const stream = fs.createReadStream(filePath);

        stream.on("data", (chunk) => {
            try {
                const decryptedChunk = decipher.update(chunk);
                if (decryptedChunk.length > 0) {
                    hash.update(decryptedChunk);
                }
            } catch (err) {
                stream.destroy(err);
            }
        });

        stream.on("end", () => {
            try {
                const finalChunk = decipher.final();
                if (finalChunk.length > 0) {
                    hash.update(finalChunk);
                }
                resolve(hash.digest("hex"));
            } catch (authErr) {
                reject(authErr);
            }
        });

        stream.on("error", (err) => {
            reject(err);
        });
    });
};

const getSystemAdminId = async () => {
    const res = await pool.query("SELECT user_id FROM users WHERE role_id = 1 AND is_active = TRUE ORDER BY user_id ASC LIMIT 1;");
    return res.rows[0] ? res.rows[0].user_id : null;
};

const resolveEvidenceFilePath = (filePath) => {
    if (!filePath) return null;
    if (path.isAbsolute(filePath) && fs.existsSync(filePath)) {
        return filePath;
    }
    const backendRoot = path.resolve(__dirname, "../../");
    const candidates = [
        path.resolve(backendRoot, filePath),
        path.resolve(backendRoot, "uploads", path.basename(filePath)),
        path.resolve(backendRoot, "uploads/encrypted", path.basename(filePath)),
        path.resolve(process.cwd(), filePath),
        path.resolve(process.cwd(), "uploads", path.basename(filePath)),
        path.resolve(process.cwd(), "uploads/encrypted", path.basename(filePath))
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return candidates[0];
};

/**
 * Checks integrity of a single evidence record using streaming computation.
 *
 * @param {Object} evidenceItem Database row from evidence table
 * @param {number|null} scanUserId ID of the user requesting the scan (null for background scheduler)
 * @param {number|null} preloadedAdminId Preloaded admin ID to avoid repeated DB lookups
 * @returns {Promise<Object>} Verification status object
 */
const checkEvidenceIntegrity = async (evidenceItem, scanUserId = null, preloadedAdminId = null) => {
    const {
        evidence_id,
        case_id,
        evidence_number,
        file_path,
        file_hash,
        encrypted_aes_key,
        encryption_iv,
        encryption_auth_tag,
        is_legacy_seed
    } = evidenceItem;

    // Use clear SYSTEM actor (null) when run by background scheduler
    const auditUserId = scanUserId || null;
    const absolutePath = resolveEvidenceFilePath(file_path);

    // Strictly verified legacy seed records
    const isVerifiedLegacySeed = Boolean(
        is_legacy_seed === true ||
        (Number(evidence_id) <= 3 && encrypted_aes_key === "temporary_key")
    );

    if (!fs.existsSync(absolutePath)) {
        if (isVerifiedLegacySeed) {
            return {
                status: "LEGACY_SEED",
                evidence_id,
                evidence_number,
                is_legacy_seed: true,
                message: "Catalog-only seed exhibit (no disk payload). Skipped from tamper alerts.",
                new_alert_created: false
            };
        }

        // Raise CRITICAL FILE_MISSING alert
        const alertRes = await alertModel.createAlert({
            evidence_id,
            case_id,
            alert_type: "FILE_MISSING",
            severity: "CRITICAL",
            stored_hash: file_hash,
            detected_hash: null,
            file_path,
            message: `Evidence file ${evidence_number} is missing from disk storage at ${file_path}`,
            email_status: "PENDING",
            email_attempts: 0
        });

        const isNew = alertRes && alertRes.is_new;
        if (isNew) {
            await auditService.createAuditLog(
                auditUserId,
                evidence_id,
                "TAMPER_DETECTED",
                `[SYSTEM] CRITICAL: Evidence file missing from storage: ${evidence_number}`
            );
        }

        return {
            status: "FILE_MISSING",
            evidence_id,
            evidence_number,
            new_alert_created: isNew,
            alert: alertRes
        };
    }

    try {
        let calculatedHash;

        if (encrypted_aes_key && encryption_iv && encryption_auth_tag) {
            // Step 1: Unwrap the per-file AES key
            let fileKeyHex;
            try {
                fileKeyHex = decryptAESKey(encrypted_aes_key);
            } catch (keyErr) {
                // SYSTEM ERROR: Key-unwrap failure (e.g. invalid MASTER_ENCRYPTION_KEY or corrupt wrap)
                // One system warning, NO per-record evidence alerts per requirement 3.
                return {
                    status: "KEY_UNWRAP_FAILED",
                    evidence_id,
                    evidence_number,
                    is_system_error: true,
                    error: keyErr.message,
                    new_alert_created: false
                };
            }

            // Step 2: Stream decrypt and hash
            const fileKeyBuffer = Buffer.from(fileKeyHex, "hex");
            const ivBuffer = Buffer.from(encryption_iv, "hex");
            const authTagBuffer = Buffer.from(encryption_auth_tag, "hex");

            try {
                calculatedHash = await streamDecryptAndHash(
                    absolutePath,
                    fileKeyBuffer,
                    ivBuffer,
                    authTagBuffer
                );
            } catch (gcmErr) {
                // GCM authentication failure / ciphertext corruption -> CORRUPTED_CIPHERTEXT
                const alertRes = await alertModel.createAlert({
                    evidence_id,
                    case_id,
                    alert_type: "CORRUPTED_CIPHERTEXT",
                    severity: "CRITICAL",
                    stored_hash: file_hash,
                    detected_hash: null,
                    file_path,
                    message: `Encrypted file for ${evidence_number} failed AES-256-GCM authentication or decryption: ${gcmErr.message}`,
                    email_status: "PENDING",
                    email_attempts: 0
                });

                const isNew = alertRes && alertRes.is_new;
                if (isNew) {
                    await auditService.createAuditLog(
                        auditUserId,
                        evidence_id,
                        "TAMPER_DETECTED",
                        `[SYSTEM] CRITICAL: Ciphertext corruption detected in evidence ${evidence_number}`
                    );
                }

                return {
                    status: "CORRUPTED_CIPHERTEXT",
                    evidence_id,
                    evidence_number,
                    new_alert_created: isNew,
                    alert: alertRes
                };
            }
        } else {
            // Unencrypted physical file -> streaming SHA-256
            calculatedHash = await streamComputeFileSha256(absolutePath);
        }

        // Compare calculated hash against stored hash
        if (calculatedHash !== file_hash) {
            const alertRes = await alertModel.createAlert({
                evidence_id,
                case_id,
                alert_type: "HASH_MISMATCH",
                severity: "CRITICAL",
                stored_hash: file_hash,
                detected_hash: calculatedHash,
                file_path,
                message: `SHA-256 mismatch detected for evidence ${evidence_number}. Stored: ${file_hash}, Detected: ${calculatedHash}`,
                email_status: "PENDING",
                email_attempts: 0
            });

            const isNew = alertRes && alertRes.is_new;
            if (isNew) {
                await auditService.createAuditLog(
                    auditUserId,
                    evidence_id,
                    "TAMPER_DETECTED",
                    `[SYSTEM] CRITICAL: SHA-256 hash mismatch detected for evidence ${evidence_number}`
                );
            }

            return {
                status: "HASH_MISMATCH",
                evidence_id,
                evidence_number,
                calculatedHash,
                storedHash: file_hash,
                new_alert_created: isNew,
                alert: alertRes
            };
        }

        return {
            status: "INTACT",
            evidence_id,
            evidence_number,
            hash: calculatedHash,
            new_alert_created: false
        };
    } catch (err) {
        // Unexpected scan execution error -> create SCAN_ERROR alert with duplicate suppression
        let newAlertCreated = false;
        let alertRes = null;
        try {
            alertRes = await alertModel.createAlert({
                evidence_id,
                case_id,
                alert_type: "SCAN_ERROR",
                severity: "HIGH",
                stored_hash: file_hash,
                detected_hash: null,
                file_path,
                message: `Integrity scan error for ${evidence_number}: ${err.message}`,
                email_status: "PENDING",
                email_attempts: 0
            });

            if (alertRes && alertRes.is_new) {
                newAlertCreated = true;
                await auditService.createAuditLog(
                    auditUserId,
                    evidence_id,
                    "SCAN_ERROR",
                    `[SYSTEM] Integrity scan error for evidence ${evidence_number}: ${err.message}`
                );
            }
        } catch (_) {}

        return {
            status: "ERROR",
            evidence_id,
            evidence_number,
            error: err.message,
            new_alert_created: newAlertCreated,
            alert: alertRes
        };
    }
};

/**
 * Retries dispatch of any active alerts with PENDING or FAILED email status (up to 5 attempts).
 */
const retryUnsentAlertEmails = async (auditUserId = null, excludeAlertIds = []) => {
    try {
        const rawAlerts = await alertModel.getUnsentActiveAlerts(5);
        if (!rawAlerts || rawAlerts.length === 0) {
            return { retried: 0, successful: 0 };
        }

        const unsentAlerts = Array.isArray(excludeAlertIds) && excludeAlertIds.length > 0
            ? rawAlerts.filter(a => !excludeAlertIds.includes(a.alert_id))
            : rawAlerts;

        if (unsentAlerts.length === 0) {
            return { retried: 0, successful: 0 };
        }

        let sendResult;
        if (unsentAlerts.length === 1) {
            sendResult = await emailService.sendTamperAlertEmail(unsentAlerts[0]);
        } else {
            sendResult = await emailService.sendTamperAlertDigestEmail(unsentAlerts);
        }

        let successful = 0;
        for (const alert of unsentAlerts) {
            const newAttempts = (alert.email_attempts || 0) + 1;
            if (sendResult.sent) {
                await alertModel.updateAlertEmailDispatch(alert.alert_id, {
                    email_status: "SENT",
                    email_attempts: newAttempts,
                    email_sent_at: new Date(),
                    email_last_error: null
                });
                await auditService.createAuditLog(
                    auditUserId,
                    alert.evidence_id,
                    "EMAIL_ALERT_SENT",
                    `[SYSTEM] Alert email successfully delivered on retry attempt ${newAttempts}`
                );
                successful++;
            } else {
                const newStatus = newAttempts >= 5 ? "FAILED" : "PENDING";
                const safeErr = sendResult.error || sendResult.reason || "SMTP delivery failure";
                await alertModel.updateAlertEmailDispatch(alert.alert_id, {
                    email_status: newStatus,
                    email_attempts: newAttempts,
                    email_last_error: safeErr
                });
                await auditService.createAuditLog(
                    auditUserId,
                    alert.evidence_id,
                    "EMAIL_ALERT_FAILED",
                    `[SYSTEM] Alert email delivery failed on retry attempt ${newAttempts}/5: ${safeErr}`
                );
            }
        }

        return { retried: unsentAlerts.length, successful };
    } catch (err) {
        console.warn("[AlertService] Unsent alert email retry loop failed:", err.message);
        return { retried: 0, successful: 0, error: err.message };
    }
};

/**
 * Runs a complete cryptographic scan over all evidence exhibits.
 * Protected by scanRunning mutex guard so concurrent executions never overlap.
 */
const scanAllEvidenceIntegrity = async (scanUserId = null) => {
    if (isScanRunning) {
        console.warn("[AlertService] Scan requested while previous scan is in progress. Skipping concurrent run.");
        return {
            already_running: true,
            message: "Integrity scan is already in progress. Concurrent execution prevented.",
            scanned: 0,
            intact: 0,
            legacy_seed: 0,
            compromised: 0,
            new_alerts_dispatched: 0,
            results: []
        };
    }

    isScanRunning = true;

    try {
        // Preload admin ID once for the entire scan
        const adminId = scanUserId || (await getSystemAdminId());

        const query = `
            SELECT 
                evidence_id,
                evidence_number,
                case_id,
                evidence_name,
                description,
                file_name,
                file_path,
                file_hash,
                encrypted_aes_key,
                encryption_iv,
                encryption_auth_tag,
                is_legacy_seed
            FROM evidence
            ORDER BY evidence_id ASC;
        `;
        const result = await pool.query(query);
        const items = result.rows;
        const scanResults = [];
        const newlyCreatedAlerts = [];

        for (const item of items) {
            const res = await checkEvidenceIntegrity(item, scanUserId, adminId);
            scanResults.push(res);

            if (res.new_alert_created && res.alert) {
                newlyCreatedAlerts.push({
                    ...res.alert,
                    evidence_number: item.evidence_number,
                    evidence_name: item.evidence_name
                });
            }
        }

        // Handle key unwrap failures as a single system-level warning (no per-record alerts)
        const keyUnwrapFailures = scanResults.filter(r => r.status === "KEY_UNWRAP_FAILED");
        if (keyUnwrapFailures.length > 0) {
            console.warn(`[AlertService] Master key unwrap failure detected on ${keyUnwrapFailures.length} exhibits. Check MASTER_ENCRYPTION_KEY.`);
            await auditService.createAuditLog(
                scanUserId || null,
                null,
                "SYSTEM_WARNING",
                `[SYSTEM] Master key unwrap failure detected on ${keyUnwrapFailures.length} exhibits during integrity scan: ${keyUnwrapFailures[0].error}`
            );
        }

        // Email newly created alerts: single email if 1, digest email if > 1
        if (newlyCreatedAlerts.length === 1) {
            const singleAlert = newlyCreatedAlerts[0];
            try {
                const sendResult = await emailService.sendTamperAlertEmail({
                    ...singleAlert,
                    audit_user_id: adminId
                });

                const isSent = Boolean(sendResult && sendResult.sent);
                const safeErr = isSent ? null : (sendResult.error || sendResult.reason || "Failed to dispatch email");
                await alertModel.updateAlertEmailDispatch(singleAlert.alert_id, {
                    email_status: isSent ? "SENT" : "FAILED",
                    email_attempts: 1,
                    email_sent_at: isSent ? new Date() : null,
                    email_last_error: safeErr
                });

                if (isSent) {
                    await auditService.createAuditLog(
                        adminId,
                        singleAlert.evidence_id,
                        "EMAIL_ALERT_SENT",
                        `[SYSTEM] Tamper alert notification email delivered to ${emailService.maskEmail(sendResult.recipient)} (attempt 1/5)`
                    );
                } else {
                    await auditService.createAuditLog(
                        adminId,
                        singleAlert.evidence_id,
                        "EMAIL_ALERT_FAILED",
                        `[SYSTEM] Tamper alert notification email dispatch failed (attempt 1/5): ${safeErr}`
                    );
                }
            } catch (emErr) {
                await alertModel.updateAlertEmailDispatch(singleAlert.alert_id, {
                    email_status: "FAILED",
                    email_attempts: 1,
                    email_last_error: emErr.message
                });
                await auditService.createAuditLog(
                    adminId,
                    singleAlert.evidence_id,
                    "EMAIL_ALERT_FAILED",
                    `[SYSTEM] Tamper alert notification email dispatch failed (attempt 1/5): ${emErr.message}`
                );
            }
        } else if (newlyCreatedAlerts.length > 1) {
            try {
                const digestResult = await emailService.sendTamperAlertDigestEmail(newlyCreatedAlerts);
                const isSent = Boolean(digestResult && digestResult.sent);
                const safeErr = isSent ? null : (digestResult.error || digestResult.reason || "Failed to dispatch digest");

                for (const alert of newlyCreatedAlerts) {
                    await alertModel.updateAlertEmailDispatch(alert.alert_id, {
                        email_status: isSent ? "SENT" : "FAILED",
                        email_attempts: 1,
                        email_sent_at: isSent ? new Date() : null,
                        email_last_error: safeErr
                    });

                    if (isSent) {
                        await auditService.createAuditLog(
                            adminId,
                            alert.evidence_id,
                            "EMAIL_ALERT_SENT",
                            `[SYSTEM] Digest notification delivered to ${emailService.maskEmail(digestResult.recipient)} (attempt 1/5)`
                        );
                    } else {
                        await auditService.createAuditLog(
                            adminId,
                            alert.evidence_id,
                            "EMAIL_ALERT_FAILED",
                            `[SYSTEM] Digest notification dispatch failed (attempt 1/5): ${safeErr}`
                        );
                    }
                }
            } catch (emErr) {
                for (const alert of newlyCreatedAlerts) {
                    await alertModel.updateAlertEmailDispatch(alert.alert_id, {
                        email_status: "FAILED",
                        email_attempts: 1,
                        email_last_error: emErr.message
                    });
                    await auditService.createAuditLog(
                        adminId,
                        alert.evidence_id,
                        "EMAIL_ALERT_FAILED",
                        `[SYSTEM] Digest notification dispatch failed (attempt 1/5): ${emErr.message}`
                    );
                }
            }
        }

        // Retry previously unsent/failed alert emails (excluding alerts just processed above)
        const newlyCreatedIds = newlyCreatedAlerts.map(a => a.alert_id);
        await retryUnsentAlertEmails(scanUserId || null, newlyCreatedIds);

        const scanned = scanResults.length;
        const intact = scanResults.filter(r => r.status === "INTACT").length;
        const legacy_seed = scanResults.filter(r => r.status === "LEGACY_SEED").length;
        // Exclude INTACT, LEGACY_SEED, and KEY_UNWRAP_FAILED from compromised count
        const compromised = scanResults.filter(r => r.status !== "INTACT" && r.status !== "LEGACY_SEED" && r.status !== "KEY_UNWRAP_FAILED").length;
        const new_alerts_dispatched = newlyCreatedAlerts.length;

        return {
            results: scanResults,
            scanned,
            intact,
            legacy_seed,
            compromised,
            new_alerts_dispatched
        };
    } finally {
        isScanRunning = false;
    }
};

const resolveAlert = async (alertId, userId, notes) => {
    if (!userId) {
        throw new Error("Authenticated user required to resolve alerts");
    }
    const resolved = await alertModel.resolveAlert(alertId, userId, notes);
    if (!resolved) {
        throw new Error("Alert not found or already resolved");
    }

    await auditService.createAuditLog(
        userId,
        resolved.evidence_id,
        "ALERT_RESOLVED",
        `Tamper alert #${alertId} marked as RESOLVED by User ID ${userId}. Notes: ${notes || "None provided"}`
    );

    return resolved;
};

module.exports = {
    checkEvidenceIntegrity,
    scanAllEvidenceIntegrity,
    retryUnsentAlertEmails,
    resolveAlert,
    getIsScanRunning
};
