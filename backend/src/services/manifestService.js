const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const pool = require("../config/db");
const auditService = require("./auditService");
const emailService = require("./emailService");

/**
 * Returns the directory for external manifest storage outside the project repository.
 */
const getManifestDir = () => {
    const customDir = process.env.MANIFEST_DIR;
    if (customDir && customDir.trim()) {
        const resolved = path.resolve(customDir.trim());
        if (!fs.existsSync(resolved)) {
            fs.mkdirSync(resolved, { recursive: true });
        }
        return resolved;
    }

    const baseHome = process.env.USERPROFILE || process.env.APPDATA || process.env.HOME || "C:/Users/vrind";
    const defaultDir = path.resolve(baseHome, ".digital_evidence_vault", "manifests");
    if (!fs.existsSync(defaultDir)) {
        fs.mkdirSync(defaultDir, { recursive: true });
    }
    return defaultDir;
};

/**
 * Returns the HMAC signing key for the integrity manifest.
 */
const getManifestSigningKey = () => {
    return process.env.MANIFEST_SIGNING_KEY || process.env.MASTER_ENCRYPTION_KEY || "default_evidence_vault_hmac_signing_key";
};

/**
 * Deterministically computes an HMAC-SHA256 signature for the manifest payload.
 */
const computeManifestHmac = (payload) => {
    const key = getManifestSigningKey();
    const canonicalString = JSON.stringify(payload);
    return crypto.createHmac("sha256", key).update(canonicalString, "utf8").digest("hex");
};

/**
 * Generates, signs, saves, and emails a daily cryptographic integrity manifest.
 *
 * @param {number|null} requestedByUserId User ID triggering generation (or null for background scheduler)
 * @returns {Promise<Object>} The signed manifest document
 */
const generateDailySignedManifest = async (requestedByUserId = null) => {
    const manifestDir = getManifestDir();
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];

    // 1. Fetch current evidence state from database
    const evQuery = `
        SELECT 
            evidence_id,
            evidence_number,
            file_hash,
            is_legacy_seed
        FROM evidence
        ORDER BY evidence_id ASC;
    `;
    const evResult = await pool.query(evQuery);
    const evidenceRows = evResult.rows;

    // 2. Fetch the latest audit log chain hash
    const latestAuditHash = await auditService.getLatestAuditHash();

    // 3. Construct manifest payload
    const payload = {
        version: "1.0",
        generated_at: now.toISOString(),
        total_records: evidenceRows.length,
        latest_audit_hash: latestAuditHash || "0".repeat(64),
        records: evidenceRows.map(r => ({
            evidence_id: r.evidence_id,
            evidence_number: r.evidence_number,
            file_hash: r.file_hash,
            is_legacy_seed: Boolean(r.is_legacy_seed)
        }))
    };

    // 4. Sign payload with HMAC-SHA256
    const hmac = computeManifestHmac(payload);

    const signedDocument = {
        ...payload,
        signature: {
            algorithm: "HMAC-SHA256",
            hmac
        }
    };

    // 5. Save to disk outside the project repository
    const latestPath = path.join(manifestDir, "manifest-latest.json");
    const dailyPath = path.join(manifestDir, `manifest-${dateStr}.json`);

    fs.writeFileSync(latestPath, JSON.stringify(signedDocument, null, 2), "utf8");
    fs.writeFileSync(dailyPath, JSON.stringify(signedDocument, null, 2), "utf8");

    // 6. Email the signed manifest to the administrator
    try {
        await emailService.sendSignedManifestEmail(signedDocument);
    } catch (emErr) {
        console.warn("[ManifestService] Manifest dispatch email failed:", emErr.message);
    }

    // 7. Write audit log entry
    try {
        await auditService.createAuditLog(
            requestedByUserId,
            null,
            "MANIFEST_GENERATED",
            `[SYSTEM] Signed integrity manifest generated (${evidenceRows.length} exhibits, audit head: ${latestAuditHash.substring(0, 16)}...)`
        );
    } catch (_) {}

    return signedDocument;
};

/**
 * Loads the latest signed manifest from disk.
 */
const loadLatestManifest = () => {
    const manifestDir = getManifestDir();
    const latestPath = path.join(manifestDir, "manifest-latest.json");
    if (!fs.existsSync(latestPath)) {
        return null;
    }
    try {
        const raw = fs.readFileSync(latestPath, "utf8");
        return JSON.parse(raw);
    } catch (_) {
        return null;
    }
};

/**
 * Verifies the cryptographic HMAC signature of a manifest document.
 */
const verifyManifestSignature = (manifestDocument) => {
    if (!manifestDocument || !manifestDocument.signature || !manifestDocument.signature.hmac) {
        return false;
    }

    const { signature, ...payload } = manifestDocument;
    const computedHmac = computeManifestHmac(payload);

    return computedHmac === signature.hmac;
};

/**
 * Compares current database evidence rows against the latest signed manifest.
 * Checks for manifest signature tampering, evidence hash mismatches, and deleted records.
 */
const compareDatabaseWithManifest = async () => {
    let manifest = loadLatestManifest();
    if (!manifest) {
        // If no manifest exists yet, generate initial baseline manifest
        manifest = await generateDailySignedManifest();
        return {
            valid: true,
            is_initial: true,
            mismatches: [],
            deleted_records: [],
            manifest
        };
    }

    // 1. Verify HMAC signature of the manifest
    const isHmacValid = verifyManifestSignature(manifest);
    if (!isHmacValid) {
        return {
            valid: false,
            manifest_tampered: true,
            reason: "MANIFEST_TAMPERED",
            message: "Signed manifest HMAC signature verification failed! The external integrity manifest has been tampered with.",
            mismatches: [],
            deleted_records: [],
            manifest
        };
    }

    // 2. Fetch current evidence records from DB
    const evResult = await pool.query(`
        SELECT evidence_id, evidence_number, file_hash, is_legacy_seed
        FROM evidence;
    `);
    const dbMap = new Map();
    evResult.rows.forEach(r => dbMap.set(r.evidence_id, r));

    const mismatches = [];
    const deletedRecords = [];

    // 3. Compare manifest records against database
    for (const manifestRec of manifest.records || []) {
        const dbRec = dbMap.get(manifestRec.evidence_id);
        if (!dbRec) {
            // Evidence ID existed in signed manifest but is missing from DB -> EVIDENCE_RECORD_DELETED
            deletedRecords.push({
                evidence_id: manifestRec.evidence_id,
                evidence_number: manifestRec.evidence_number,
                manifest_hash: manifestRec.file_hash,
                is_legacy_seed: manifestRec.is_legacy_seed
            });
        } else if (dbRec.file_hash !== manifestRec.file_hash) {
            // Database file_hash differs from signed manifest -> MANIFEST_HASH_MISMATCH
            mismatches.push({
                evidence_id: dbRec.evidence_id,
                evidence_number: dbRec.evidence_number,
                db_hash: dbRec.file_hash,
                manifest_hash: manifestRec.file_hash
            });
        }
    }

    // 4. Check if manifest's latest_audit_hash exists in audit_logs
    let auditChainConsistent = true;
    if (manifest.latest_audit_hash && manifest.latest_audit_hash !== "0".repeat(64)) {
        const auditCheck = await pool.query(
            "SELECT audit_id FROM audit_logs WHERE entry_hash = $1 LIMIT 1;",
            [manifest.latest_audit_hash]
        );
        if (auditCheck.rows.length === 0) {
            auditChainConsistent = false;
        }
    }

    const isValid = isHmacValid && mismatches.length === 0 && deletedRecords.length === 0 && auditChainConsistent;

    return {
        valid: isValid,
        manifest_tampered: !isHmacValid,
        audit_chain_consistent: auditChainConsistent,
        mismatches,
        deleted_records: deletedRecords,
        manifest
    };
};

module.exports = {
    getManifestDir,
    getManifestSigningKey,
    computeManifestHmac,
    generateDailySignedManifest,
    loadLatestManifest,
    verifyManifestSignature,
    compareDatabaseWithManifest
};

