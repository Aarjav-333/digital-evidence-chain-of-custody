/**
 * Role-Based Access Control (RBAC) Verification Script for Evidence Decryption & Legacy Download
 *
 * Verifies access controls across all 4 system roles:
 *   - Role 1: System Administrator (Decrypt + Legacy Download Allowed)
 *   - Role 2: Police Officer (Decrypt + Legacy Download Forbidden: 403)
 *   - Role 3: Case Manager (Decrypt + Legacy Download Forbidden: 403)
 *   - Role 4: Forensic Analyst (Decrypt + Legacy Download Allowed)
 *
 * Verifies:
 *   - GET /api/evidence (200 for all)
 *   - GET /api/evidence/11/verify (200 for all)
 *   - GET /api/evidence/11/decrypt (200 for 1 & 4, 403 for 2 & 3)
 *   - Decrypted stream SHA-256 digest match against stored hash
 *   - GET /api/evidence/4/legacy-download (200 for 1 & 4, 403 for 2 & 3)
 *   - Legacy download stream SHA-256 digest match against stored hash
 *   - GET /api/evidence/1/legacy-download (404 for 1 & 4, 403 for 2 & 3)
 *   - Audit log entries recorded for DECRYPTED and LEGACY_FILE_DOWNLOAD
 *
 * Security: NEVER prints passwords, tokens, or raw secrets.
 */

const crypto = require("crypto");
const pool = require("../config/db");

const API_BASE = process.env.API_BASE || "http://localhost:3000";

const TEST_ACCOUNTS = [
    { role_id: 1, role_name: "System Administrator", employee_id: "POL2026002" },
    { role_id: 2, role_name: "Police Officer", employee_id: "POL2026001" },
    { role_id: 3, role_name: "Case Manager", employee_id: "CAS2026001" },
    { role_id: 4, role_name: "Forensic Analyst", employee_id: "POL2026003" }
];

async function loginUser(employee_id) {
    const res = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            employee_id,
            password: process.env.TEST_PASSWORD || "Admin@123"
        })
    });
    const data = await res.json();
    if (!data.success || !data.data?.token) {
        throw new Error(`Login failed for ${employee_id}: ${data.message || "Unknown error"}`);
    }
    return {
        token: data.data.token,
        user: data.data.user
    };
}

async function runVerification() {
    console.log("================================================================================");
    console.log("Starting RBAC Verification for Evidence Decryption & Legacy Download");
    console.log("Target API Base:", API_BASE);
    console.log("================================================================================\n");

    // Fetch evidence metadata from database
    const ev11 = (await pool.query("SELECT evidence_id, evidence_number, file_hash FROM evidence WHERE evidence_id = 11;")).rows[0];
    const ev4 = (await pool.query("SELECT evidence_id, evidence_number, file_hash FROM evidence WHERE evidence_id = 4;")).rows[0];
    const ev1 = (await pool.query("SELECT evidence_id, evidence_number, file_hash, is_legacy_seed FROM evidence WHERE evidence_id = 1;")).rows[0];

    console.log(`[Target Records]`);
    console.log(`- Record 11 (Encrypted): ${ev11?.evidence_number} | Stored SHA-256: ${ev11?.file_hash?.substring(0, 16)}...`);
    console.log(`- Record 4 (Legacy File): ${ev4?.evidence_number} | Stored SHA-256: ${ev4?.file_hash?.substring(0, 16)}...`);
    console.log(`- Record 1 (Legacy Seed): ${ev1?.evidence_number} | is_legacy_seed: ${ev1?.is_legacy_seed}\n`);

    const authTokens = {};
    for (const acct of TEST_ACCOUNTS) {
        try {
            const auth = await loginUser(acct.employee_id);
            authTokens[acct.role_id] = auth.token;
            console.log(`[Auth] Logged in as Role ${acct.role_id} (${acct.role_name}): [SUCCESS]`);
        } catch (err) {
            console.error(`[Auth] Failed to log in as Role ${acct.role_id}:`, err.message);
        }
    }
    console.log("");

    const results = [];
    const hashVerifications = {};

    for (const acct of TEST_ACCOUNTS) {
        const token = authTokens[acct.role_id];
        if (!token) continue;

        const headers = { Authorization: `Bearer ${token}` };

        const roleResult = {
            role_id: acct.role_id,
            role_name: acct.role_name
        };

        // 1. List Evidence
        const rList = await fetch(`${API_BASE}/api/evidence`, { headers });
        roleResult.list_evidence = rList.status;

        // 2. Verify Integrity
        const rVerify = await fetch(`${API_BASE}/api/evidence/11/verify`, { headers });
        roleResult.verify_integrity = rVerify.status;

        // 3. Decrypt Record 11
        const rDecrypt = await fetch(`${API_BASE}/api/evidence/11/decrypt`, { headers });
        roleResult.decrypt_record_11 = rDecrypt.status;
        if (rDecrypt.status === 200) {
            const arrayBuf = await rDecrypt.arrayBuffer();
            const downloadedHash = crypto.createHash("sha256").update(Buffer.from(arrayBuf)).digest("hex");
            const hashMatch = downloadedHash === ev11.file_hash;
            hashVerifications[`Role_${acct.role_id}_Decrypt_11`] = {
                downloadedBytes: arrayBuf.byteLength,
                downloadedHash,
                storedHash: ev11.file_hash,
                match: hashMatch
            };
            roleResult.decrypt_11_hash_match = hashMatch ? "MATCH" : "MISMATCH";
        } else {
            roleResult.decrypt_11_hash_match = "N/A (Forbidden)";
        }

        // 4. Legacy Download Record 4 (physical legacy file)
        const rLegacy4 = await fetch(`${API_BASE}/api/evidence/4/legacy-download`, { headers });
        roleResult.legacy_download_4 = rLegacy4.status;
        if (rLegacy4.status === 200) {
            const arrayBuf = await rLegacy4.arrayBuffer();
            const downloadedHash = crypto.createHash("sha256").update(Buffer.from(arrayBuf)).digest("hex");
            const hashMatch = downloadedHash === ev4.file_hash;
            hashVerifications[`Role_${acct.role_id}_Legacy_4`] = {
                downloadedBytes: arrayBuf.byteLength,
                downloadedHash,
                storedHash: ev4.file_hash,
                match: hashMatch
            };
            roleResult.legacy_4_hash_match = hashMatch ? "MATCH" : "MISMATCH";
        } else {
            roleResult.legacy_4_hash_match = "N/A (Forbidden)";
        }

        // 5. Legacy Download Record 1 (catalog seed record without physical file)
        const rLegacy1 = await fetch(`${API_BASE}/api/evidence/1/legacy-download`, { headers });
        roleResult.legacy_download_1 = rLegacy1.status;

        results.push(roleResult);
    }

    console.log("================================================================================");
    console.log("EVIDENCE PERMISSION MATRIX RESULTS");
    console.log("================================================================================\n");

    console.table(results.map(r => ({
        "Role": `${r.role_id}: ${r.role_name.split(' ')[0]}`,
        "List": r.list_evidence,
        "Verify": r.verify_integrity,
        "Decrypt 11": r.decrypt_record_11,
        "Dec Hash": r.decrypt_11_hash_match,
        "Legacy 4": r.legacy_download_4,
        "Leg Hash": r.legacy_4_hash_match,
        "Legacy 1 (Seed)": r.legacy_download_1
    })));

    console.log("\n[Cryptographic SHA-256 Hash Verification Details]");
    for (const [key, val] of Object.entries(hashVerifications)) {
        console.log(`- ${key}:`);
        console.log(`    Downloaded Bytes: ${val.downloadedBytes} bytes`);
        console.log(`    Downloaded SHA-256: ${val.downloadedHash}`);
        console.log(`    Stored SHA-256:     ${val.storedHash}`);
        console.log(`    Cryptographic Match: ${val.match ? "PASSED (IDENTICAL)" : "FAILED"}`);
    }

    // Inspect Audit Logs for DECRYPTED and LEGACY_FILE_DOWNLOAD
    const auditRes = await pool.query(`
        SELECT audit_id, user_id, action, details, created_at
        FROM audit_logs
        WHERE action IN ('DECRYPTED', 'LEGACY_FILE_DOWNLOAD', 'ACCESS_DENIED')
        ORDER BY audit_id DESC
        LIMIT 8;
    `);

    console.log("\n[Recent Audit Logs]");
    auditRes.rows.forEach(log => {
        console.log(`  - Audit #${log.audit_id} | Action: ${log.action} | ${log.details}`);
    });

    console.log("\n================================================================================");
    console.log("Verification Complete");
    console.log("================================================================================\n");

    await pool.end();
}

runVerification().catch(err => {
    console.error("Verification failed:", err);
    process.exit(1);
});

