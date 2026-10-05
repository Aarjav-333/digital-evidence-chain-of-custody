const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const pool = require("../config/db");
const alertModel = require("../models/alertModel");
const auditService = require("./auditService");
const emailService = require("./emailService");
const { decryptAESKey } = require("../utils/encryption");

const computeFileSha256 = (buffer) => {
    return crypto.createHash("sha256").update(buffer).digest("hex");
};

const getSystemAdminId = async () => {
    const res = await pool.query("SELECT user_id FROM users WHERE role_id = 1 AND is_active = TRUE ORDER BY user_id ASC LIMIT 1;");
    return res.rows[0] ? res.rows[0].user_id : null;
};

const decryptEvidenceBuffer = (encryptedBuffer, encryptedKeyData, ivHex, authTagHex) => {
    const fileKeyHex = decryptAESKey(encryptedKeyData);
    const fileKey = Buffer.from(fileKeyHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", fileKey, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    return Buffer.concat([
        decipher.update(encryptedBuffer),
        decipher.final()
    ]);
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
    return candidates[0]; // Return best-guess absolute path even if not on disk
};

const checkEvidenceIntegrity = async (evidenceItem, scanUserId = null) => {
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

    const auditUserId = scanUserId || (await getSystemAdminId());
    const absolutePath = resolveEvidenceFilePath(file_path);

    // Strictly verified legacy seed records: only if is_legacy_seed column is true
    // or verified database initialization record (id <= 3 with temporary_key).
    // NO description string matching exemption is permitted.
    const isVerifiedLegacySeed = Boolean(
        is_legacy_seed === true ||
        (Number(evidence_id) <= 3 && encrypted_aes_key === "temporary_key")
    );

    if (!fs.existsSync(absolutePath)) {
        // Skip alert ONLY if this is a verified legacy seed catalog exhibit
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

        // All normal records with missing files MUST raise a CRITICAL alert
        const existing = await alertModel.findActiveAlert(evidence_id, "FILE_MISSING");
        let newAlertCreated = false;
        let emailDispatch = null;
        if (!existing) {
            const createdAlert = await alertModel.createAlert({
                evidence_id,
                case_id,
                alert_type: "FILE_MISSING",
                severity: "CRITICAL",
                stored_hash: file_hash,
                detected_hash: null,
                file_path,
                message: `Evidence file ${evidence_number} is missing from disk storage at ${file_path}`
            });
            if (auditUserId) {
                await auditService.createAuditLog(
                    auditUserId,
                    evidence_id,
                    "TAMPER_DETECTED",
                    `CRITICAL: Evidence file missing from storage: ${evidence_number}`
                );
            }
            try {
                emailDispatch = await emailService.sendTamperAlertEmail({
                    ...createdAlert,
                    evidence_number,
                    evidence_name: evidenceItem.evidence_name,
                    audit_user_id: auditUserId
                });
            } catch (emErr) {
                console.warn("[AlertService] Alert email notification error (non-fatal):", emErr.message);
            }
            newAlertCreated = true;
        }
        return {
            status: "FILE_MISSING",
            evidence_id,
            evidence_number,
            new_alert_created: newAlertCreated,
            email_dispatch: emailDispatch
        };
    }

    try {
        const diskBuffer = fs.readFileSync(absolutePath);
        let plainBuffer = diskBuffer;

        if (encrypted_aes_key && encryption_iv && encryption_auth_tag) {
            try {
                plainBuffer = decryptEvidenceBuffer(
                    diskBuffer,
                    encrypted_aes_key,
                    encryption_iv,
                    encryption_auth_tag
                );
            } catch (decErr) {
                const existing = await alertModel.findActiveAlert(evidence_id, "CORRUPTED_CIPHERTEXT");
                let newAlertCreated = false;
                let emailDispatch = null;
                if (!existing) {
                    const createdAlert = await alertModel.createAlert({
                        evidence_id,
                        case_id,
                        alert_type: "CORRUPTED_CIPHERTEXT",
                        severity: "CRITICAL",
                        stored_hash: file_hash,
                        detected_hash: null,
                        file_path,
                        message: `Encrypted file for ${evidence_number} failed AES-256-GCM authentication or decryption: ${decErr.message}`
                    });
                    if (auditUserId) {
                        await auditService.createAuditLog(
                            auditUserId,
                            evidence_id,
                            "TAMPER_DETECTED",
                            `CRITICAL: Ciphertext corruption detected in evidence ${evidence_number}`
                        );
                    }
                    try {
                        emailDispatch = await emailService.sendTamperAlertEmail({
                            ...createdAlert,
                            evidence_number,
                            evidence_name: evidenceItem.evidence_name,
                            audit_user_id: auditUserId
                        });
                    } catch (emErr) {
                        console.warn("[AlertService] Alert email notification error (non-fatal):", emErr.message);
                    }
                    newAlertCreated = true;
                }
                return {
                    status: "CORRUPTED_CIPHERTEXT",
                    evidence_id,
                    evidence_number,
                    new_alert_created: newAlertCreated,
                    email_dispatch: emailDispatch
                };
            }
        }

        const calculatedHash = computeFileSha256(plainBuffer);
        if (calculatedHash !== file_hash) {
            const existing = await alertModel.findActiveAlert(evidence_id, "HASH_MISMATCH");
            let newAlertCreated = false;
            let emailDispatch = null;
            if (!existing) {
                const createdAlert = await alertModel.createAlert({
                    evidence_id,
                    case_id,
                    alert_type: "HASH_MISMATCH",
                    severity: "CRITICAL",
                    stored_hash: file_hash,
                    detected_hash: calculatedHash,
                    file_path,
                    message: `Cryptographic hash mismatch for evidence ${evidence_number}. Stored: ${file_hash.substring(0, 16)}..., Detected: ${calculatedHash.substring(0, 16)}...`
                });
                if (auditUserId) {
                    await auditService.createAuditLog(
                        auditUserId,
                        evidence_id,
                        "TAMPER_DETECTED",
                        `CRITICAL: SHA-256 hash mismatch detected for evidence ${evidence_number}`
                    );
                }
                try {
                    emailDispatch = await emailService.sendTamperAlertEmail({
                        ...createdAlert,
                        evidence_number,
                        evidence_name: evidenceItem.evidence_name,
                        audit_user_id: auditUserId
                    });
                } catch (emErr) {
                    console.warn("[AlertService] Alert email notification error (non-fatal):", emErr.message);
                }
                newAlertCreated = true;
            }
            return {
                status: "HASH_MISMATCH",
                evidence_id,
                evidence_number,
                calculatedHash,
                storedHash: file_hash,
                new_alert_created: newAlertCreated,
                email_dispatch: emailDispatch
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
        return {
            status: "ERROR",
            evidence_id,
            evidence_number,
            error: err.message,
            new_alert_created: false
        };
    }
};

const scanAllEvidenceIntegrity = async (scanUserId = null) => {
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

    for (const item of items) {
        const res = await checkEvidenceIntegrity(item, scanUserId);
        scanResults.push(res);
    }

    const scanned = scanResults.length;
    const intact = scanResults.filter(r => r.status === "INTACT").length;
    const legacy_seed = scanResults.filter(r => r.status === "LEGACY_SEED").length;
    const compromised = scanResults.filter(r => r.status !== "INTACT" && r.status !== "LEGACY_SEED").length;
    const new_alerts_dispatched = scanResults.filter(r => r.new_alert_created === true).length;

    return {
        results: scanResults,
        scanned,
        intact,
        legacy_seed,
        compromised,
        new_alerts_dispatched
    };
};

const resolveAlert = async (alertId, userId, notes) => {
    if (!userId) {
        throw new Error("Authenticated user required to resolve alerts");
    }
    const resolved = await alertModel.resolveAlert(alertId, userId, notes);
    if (resolved) {
        await auditService.createAuditLog(
            userId,
            resolved.evidence_id,
            "ALERT_RESOLVED",
            `Tamper alert #${alertId} resolved. Notes: ${notes || "No notes provided"}`
        );
    }
    return resolved;
};

module.exports = {
    checkEvidenceIntegrity,
    scanAllEvidenceIntegrity,
    resolveAlert
};
