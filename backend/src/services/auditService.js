const crypto = require("crypto");
const pool = require("../config/db");

/**
 * Computes a deterministic SHA-256 hash for an audit log entry.
 * Canonical payload: prev_hash | audit_id | user_id | evidence_id | action | details | created_at
 *
 * @param {string} prevHash The entry_hash of the preceding audit record (or 64 zeros for genesis)
 * @param {Object} entry Audit record fields
 * @returns {string} 64-character hex SHA-256 digest
 */
const computeAuditEntryHash = (prevHash, entry) => {
    const rawPrevHash = prevHash || "0".repeat(64);
    const auditIdStr = String(entry.audit_id || "");
    const userIdStr = (entry.user_id !== null && entry.user_id !== undefined) ? String(entry.user_id) : "";
    const evidenceIdStr = (entry.evidence_id !== null && entry.evidence_id !== undefined) ? String(entry.evidence_id) : "";
    const actionStr = String(entry.action || "");
    const detailsStr = String(entry.details || "");

    let createdAtStr = "";
    if (entry.created_at instanceof Date) {
        createdAtStr = entry.created_at.toISOString();
    } else if (entry.created_at) {
        createdAtStr = new Date(entry.created_at).toISOString();
    }

    const payload = [
        rawPrevHash,
        auditIdStr,
        userIdStr,
        evidenceIdStr,
        actionStr,
        detailsStr,
        createdAtStr
    ].join("|");

    return crypto.createHash("sha256").update(payload, "utf8").digest("hex");
};

/**
 * Creates an append-only audit log chained cryptographically to the preceding record.
 */
const createAuditLog = async (
    userId,
    evidenceId,
    action,
    details
) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN;");

        // Advisory transaction lock to strictly serialize chain insertion across concurrent callers
        await client.query("SELECT pg_advisory_xact_lock(hashtext('audit_logs_chain_lock'));");

        // Fetch preceding audit record's hash
        const latestRes = await client.query(`
            SELECT audit_id, entry_hash 
            FROM audit_logs 
            ORDER BY audit_id DESC 
            LIMIT 1;
        `);

        const prevHash = (latestRes.rows.length > 0 && latestRes.rows[0].entry_hash)
            ? latestRes.rows[0].entry_hash
            : "0".repeat(64);

        // Fetch next sequential ID from identity sequence
        const seqRes = await client.query("SELECT nextval('public.audit_logs_audit_id_seq') AS next_id;");
        const nextAuditId = parseInt(seqRes.rows[0].next_id, 10);
        const createdAt = new Date();

        const entryHash = computeAuditEntryHash(prevHash, {
            audit_id: nextAuditId,
            user_id: userId,
            evidence_id: evidenceId,
            action,
            details,
            created_at: createdAt
        });

        const insertQuery = `
            INSERT INTO audit_logs 
            (
                audit_id,
                user_id,
                evidence_id,
                action,
                details,
                created_at,
                prev_hash,
                entry_hash
            )
            OVERRIDING SYSTEM VALUE
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *;
        `;

        const values = [
            nextAuditId,
            userId,
            evidenceId,
            action,
            details,
            createdAt,
            prevHash,
            entryHash
        ];

        const result = await client.query(insertQuery, values);
        await client.query("COMMIT;");

        return result.rows[0];
    } catch (err) {
        await client.query("ROLLBACK;");
        throw err;
    } finally {
        client.release();
    }
};

/**
 * Verifies the entire cryptographic integrity of the audit_logs hash chain.
 * Detects modified contents, deleted records, or reordered entries.
 *
 * @returns {Promise<Object>} Verification result
 */
const verifyAuditLogChain = async () => {
    const query = `
        SELECT 
            audit_id,
            user_id,
            evidence_id,
            action,
            details,
            created_at,
            prev_hash,
            entry_hash
        FROM audit_logs
        ORDER BY audit_id ASC;
    `;
    const result = await pool.query(query);
    const rows = result.rows;

    if (rows.length === 0) {
        return {
            valid: true,
            total: 0,
            latestHash: "0".repeat(64)
        };
    }

    let expectedPrevHash = "0".repeat(64);

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        // 1. Verify that prev_hash links to the preceding entry's hash
        if (row.prev_hash !== expectedPrevHash) {
            return {
                valid: false,
                reason: `Audit log hash chain linkage broken at audit_id ${row.audit_id}: stored prev_hash (${row.prev_hash?.substring(0, 16)}...) does not match expected preceding hash (${expectedPrevHash.substring(0, 16)}...). Detected row deletion or reordering.`,
                broken_audit_id: row.audit_id,
                expectedPrevHash,
                actualPrevHash: row.prev_hash
            };
        }

        // 2. Recompute and verify entry_hash from row data
        const computedHash = computeAuditEntryHash(row.prev_hash, row);
        if (row.entry_hash !== computedHash) {
            return {
                valid: false,
                reason: `Audit log entry tampered at audit_id ${row.audit_id}: stored entry_hash (${row.entry_hash?.substring(0, 16)}...) does not match recomputed hash (${computedHash.substring(0, 16)}...). Row content was modified.`,
                broken_audit_id: row.audit_id,
                storedEntryHash: row.entry_hash,
                computedEntryHash: computedHash
            };
        }

        expectedPrevHash = row.entry_hash;
    }

    return {
        valid: true,
        total: rows.length,
        latestHash: rows[rows.length - 1].entry_hash
    };
};

/**
 * Retrieves the latest audit log entry hash.
 */
const getLatestAuditHash = async () => {
    const res = await pool.query(`
        SELECT entry_hash 
        FROM audit_logs 
        ORDER BY audit_id DESC 
        LIMIT 1;
    `);
    return res.rows[0] ? res.rows[0].entry_hash : "0".repeat(64);
};

const getAuditLogs = async (evidenceId) => {
    const query = `
        SELECT
            a.audit_id,
            a.evidence_id,
            a.user_id,
            COALESCE(u.full_name, 'SYSTEM') AS user_name,
            COALESCE(u.employee_id, 'SYSTEM') AS employee_id,
            a.action,
            a.details,
            a.created_at,
            a.prev_hash,
            a.entry_hash
        FROM audit_logs a
        LEFT JOIN users u
            ON a.user_id = u.user_id
        WHERE a.evidence_id = $1
        ORDER BY a.created_at ASC;
    `;

    const result = await pool.query(query, [evidenceId]);
    return result.rows;
};

module.exports = {
    createAuditLog,
    getAuditLogs,
    computeAuditEntryHash,
    verifyAuditLogChain,
    getLatestAuditHash
};