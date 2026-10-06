const crypto = require("crypto");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const pool = require("../config/db");

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

async function runMigration() {
    console.log("================================================================================");
    console.log("Running Migration: Audit Log Cryptographic Hash Chain");
    console.log("================================================================================\n");

    const client = await pool.connect();
    try {
        await client.query("BEGIN;");

        // 1. Add columns and indexes if not existing
        console.log("[1/3] Adding prev_hash and entry_hash columns...");
        await client.query(`
            ALTER TABLE audit_logs 
            ADD COLUMN IF NOT EXISTS prev_hash VARCHAR(64);

            ALTER TABLE audit_logs 
            ADD COLUMN IF NOT EXISTS entry_hash VARCHAR(64);

            CREATE INDEX IF NOT EXISTS idx_audit_logs_entry_hash 
            ON audit_logs(entry_hash);

            CREATE INDEX IF NOT EXISTS idx_audit_logs_prev_hash 
            ON audit_logs(prev_hash);
        `);

        // 2. Fetch all existing rows ordered by audit_id ASC
        console.log("[2/3] Fetching existing audit logs for hash chain backfill...");
        const res = await client.query("SELECT * FROM audit_logs ORDER BY audit_id ASC;");
        const rows = res.rows;
        console.log(`Found ${rows.length} existing audit_logs rows.`);

        let currentPrevHash = "0".repeat(64);
        let updatedCount = 0;

        for (const row of rows) {
            const entryHash = computeAuditEntryHash(currentPrevHash, row);
            await client.query(
                "UPDATE audit_logs SET prev_hash = $1, entry_hash = $2 WHERE audit_id = $3;",
                [currentPrevHash, entryHash, row.audit_id]
            );
            currentPrevHash = entryHash;
            updatedCount++;
        }

        console.log(`Successfully migrated ${updatedCount} rows without modifying original content.`);

        // 3. Verify the newly written chain
        console.log("[3/3] Verifying freshly migrated audit log hash chain...");
        const verifyRes = await client.query("SELECT * FROM audit_logs ORDER BY audit_id ASC;");
        let testPrevHash = "0".repeat(64);
        for (const vRow of verifyRes.rows) {
            if (vRow.prev_hash !== testPrevHash) {
                throw new Error(`Chain mismatch at audit_id ${vRow.audit_id}: expected prev_hash ${testPrevHash}, got ${vRow.prev_hash}`);
            }
            const recomputed = computeAuditEntryHash(vRow.prev_hash, vRow);
            if (vRow.entry_hash !== recomputed) {
                throw new Error(`Hash mismatch at audit_id ${vRow.audit_id}: stored ${vRow.entry_hash}, computed ${recomputed}`);
            }
            testPrevHash = vRow.entry_hash;
        }

        await client.query("COMMIT;");
        console.log("\n[SUCCESS] Audit log hash chain migration committed and verified 100%!");
        console.log(`Latest audit chain entry_hash: ${testPrevHash}`);
    } catch (err) {
        await client.query("ROLLBACK;");
        console.error("[ERROR] Migration failed and rolled back:", err.message);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration().catch(err => {
    console.error(err);
    process.exit(1);
});

