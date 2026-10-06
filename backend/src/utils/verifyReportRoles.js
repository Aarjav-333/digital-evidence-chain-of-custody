/**
 * Role-Based Access Control (RBAC) Verification Script for Forensic Laboratory & Reports
 *
 * Verifies access controls across all 4 system roles:
 *   - Role 1: System Administrator (View-only for reports)
 *   - Role 2: Police Officer (View-only for reports)
 *   - Role 3: Case Manager (View-only for reports)
 *   - Role 4: Forensic Analyst / Officer (Full authoring and dispatch permissions)
 *
 * Checks:
 *   - View reports list: GET /api/reports/forensic (200 for all)
 *   - View autopsy list: GET /api/reports/autopsy (200 for all)
 *   - View dossier: GET /api/cases/:id/dossier (200 for all)
 *   - Download PDF: GET /api/reports/forensic/:caseId/download (200 for all)
 *   - Create Forensic Report: POST /api/reports/forensic (403 for 1, 2, 3; 201 for 4)
 *   - Dispatch Forensic Report: POST /api/reports/forensic/:id/dispatch (403 for 1, 2, 3; 200 for 4)
 *   - Create Autopsy: POST /api/reports/autopsy (403 for 1, 2, 3; 201 for 4)
 *   - Dispatch Autopsy: POST /api/reports/autopsy/:id/dispatch (403 for 1, 2, 3; 200 for 4)
 *   - Service-level authorization enforcement verification
 *   - Verification of ACCESS_DENIED records in audit_logs
 *
 * Security: NEVER prints passwords, tokens, or raw secrets to output.
 */

const pool = require("../config/db");
const reportService = require("../services/reportService");

const API_BASE = process.env.API_BASE || "http://localhost:3000";

const TEST_ACCOUNTS = [
    { role_id: 1, role_name: "System Administrator", employee_id: "POL2026002" },
    { role_id: 2, role_name: "Police Officer", employee_id: "POL2026001" },
    { role_id: 3, role_name: "Case Manager", employee_id: "CAS2026001" },
    { role_id: 4, role_name: "Forensic Analyst (Forensic Officer)", employee_id: "POL2026003" }
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
    console.log("Starting RBAC Verification for Forensic Laboratory & Reports");
    console.log("Target API Base:", API_BASE);
    console.log("================================================================================\n");

    // 1. Get sample case and evidence for tests
    const caseRes = await pool.query("SELECT case_id, case_number FROM cases ORDER BY case_id ASC LIMIT 1;");
    const evRes = await pool.query("SELECT evidence_id, evidence_number, case_id FROM evidence WHERE case_id = $1 LIMIT 1;", [caseRes.rows[0].case_id]);
    const repRes = await pool.query("SELECT report_id FROM forensic_reports LIMIT 1;");
    const autRes = await pool.query("SELECT autopsy_id FROM autopsy_records LIMIT 1;");

    const testCaseId = caseRes.rows[0]?.case_id || 5;
    const testEvId = evRes.rows[0]?.evidence_id || 4;
    const existingReportId = repRes.rows[0]?.report_id || 1;
    const existingAutopsyId = autRes.rows[0]?.autopsy_id || 1;

    console.log(`[Setup] Target Case ID: ${testCaseId}, Evidence ID: ${testEvId}`);
    console.log(`[Setup] Target Existing Report ID: ${existingReportId}, Existing Autopsy ID: ${existingAutopsyId}\n`);

    const results = [];
    const createdReportIds = [];
    const createdAutopsyIds = [];

    // Authenticate all test roles
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

    for (const acct of TEST_ACCOUNTS) {
        const token = authTokens[acct.role_id];
        if (!token) {
            console.error(`Skipping Role ${acct.role_id}: token missing`);
            continue;
        }

        const headers = {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        };

        const roleResult = {
            role_id: acct.role_id,
            role_name: acct.role_name,
            employee_id: acct.employee_id
        };

        // 1. View Reports List
        try {
            const res = await fetch(`${API_BASE}/api/reports/forensic`, { headers });
            roleResult.view_reports = res.status;
        } catch (e) {
            roleResult.view_reports = `ERR: ${e.message}`;
        }

        // 2. View Autopsy List
        try {
            const res = await fetch(`${API_BASE}/api/reports/autopsy`, { headers });
            roleResult.view_autopsy = res.status;
        } catch (e) {
            roleResult.view_autopsy = `ERR: ${e.message}`;
        }

        // 3. View Case Dossier
        try {
            const res = await fetch(`${API_BASE}/api/cases/${testCaseId}/dossier`, { headers });
            roleResult.view_dossier = res.status;
        } catch (e) {
            roleResult.view_dossier = `ERR: ${e.message}`;
        }

        // 4. Download Forensic PDF
        try {
            const res = await fetch(`${API_BASE}/api/reports/forensic/${testCaseId}/download`, { headers });
            roleResult.download_pdf = res.status;
        } catch (e) {
            roleResult.download_pdf = `ERR: ${e.message}`;
        }

        // 5. Create Forensic Report
        try {
            const res = await fetch(`${API_BASE}/api/reports/forensic`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    case_id: testCaseId,
                    evidence_id: testEvId,
                    report_title: `RBAC Test Report for Role ${acct.role_id}`,
                    report_type: "EXAMINATION_REPORT",
                    tools_used: "Autopsy v4.19",
                    findings: "Role test examination findings.",
                    conclusion: "Role test conclusion."
                })
            });
            roleResult.create_report = res.status;
            if (res.status === 201) {
                const body = await res.json();
                if (body.data?.report_id) {
                    createdReportIds.push(body.data.report_id);
                }
            } else if (res.status === 403) {
                const body = await res.json();
                roleResult.create_report_error = body.error;
                roleResult.create_report_msg = body.message;
            }
        } catch (e) {
            roleResult.create_report = `ERR: ${e.message}`;
        }

        // 6. Dispatch Forensic Report
        try {
            const res = await fetch(`${API_BASE}/api/reports/forensic/${existingReportId}/dispatch`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    recipient_agency: "Forensic Command Test",
                    transmission_priority: "STANDARD",
                    recipient_id: 6,
                    notes: "RBAC dispatch test verification"
                })
            });
            roleResult.dispatch_report = res.status;
            if (res.status === 403) {
                const body = await res.json();
                roleResult.dispatch_report_error = body.error;
            }
        } catch (e) {
            roleResult.dispatch_report = `ERR: ${e.message}`;
        }

        // 7. Create Autopsy Record
        try {
            const res = await fetch(`${API_BASE}/api/reports/autopsy`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    case_id: testCaseId,
                    evidence_id: testEvId,
                    subject_name: `Device Triage Role ${acct.role_id}`,
                    device_type: "Android Smartphone",
                    hardware_condition: "INTACT",
                    extraction_method: "LOGICAL",
                    autopsy_findings: "RBAC test autopsy findings",
                    triage_summary: "RBAC test triage completed"
                })
            });
            roleResult.create_autopsy = res.status;
            if (res.status === 201) {
                const body = await res.json();
                if (body.data?.autopsy_id) {
                    createdAutopsyIds.push(body.data.autopsy_id);
                }
            } else if (res.status === 403) {
                const body = await res.json();
                roleResult.create_autopsy_error = body.error;
            }
        } catch (e) {
            roleResult.create_autopsy = `ERR: ${e.message}`;
        }

        // 8. Dispatch Autopsy
        try {
            const res = await fetch(`${API_BASE}/api/reports/autopsy/${existingAutopsyId}/dispatch`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    dispatched_to: "Secure Evidence Vault Test",
                    recipient_id: 6,
                    dispatch_notes: "RBAC autopsy dispatch test"
                })
            });
            roleResult.dispatch_autopsy = res.status;
            if (res.status === 403) {
                const body = await res.json();
                roleResult.dispatch_autopsy_error = body.error;
            }
        } catch (e) {
            roleResult.dispatch_autopsy = `ERR: ${e.message}`;
        }

        results.push(roleResult);
    }

    // 9. Direct Service Layer Guard Test (defense-in-depth verification)
    console.log("[Service Layer Check] Verifying direct call to reportService.createForensicReport with Role 1...");
    let serviceBypassBlocked = false;
    let serviceErrorMessage = "";
    try {
        await reportService.createForensicReport(
            {
                case_id: testCaseId,
                evidence_id: testEvId,
                report_title: "Direct Service Bypass Test",
                tools_used: "Direct call",
                findings: "Should fail",
                conclusion: "Should fail"
            },
            { user_id: 6, role_id: 1, employee_id: "POL2026002" }
        );
    } catch (err) {
        if (err.statusCode === 403 && err.message === "Your role has view-only access to reports.") {
            serviceBypassBlocked = true;
            serviceErrorMessage = err.message;
        } else {
            serviceErrorMessage = `Unexpected error: ${err.message}`;
        }
    }

    // 10. Audit Log Inspection for ACCESS_DENIED records
    const auditRes = await pool.query(`
        SELECT 
            al.audit_id,
            al.user_id,
            u.employee_id,
            al.action,
            al.details,
            al.created_at
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.user_id
        WHERE al.action = 'ACCESS_DENIED'
        ORDER BY al.audit_id DESC
        LIMIT 10;
    `);

    // Clean up test reports created by Role 4 so DB state is tidy
    if (createdReportIds.length > 0) {
        await pool.query("DELETE FROM forensic_reports WHERE report_id = ANY($1);", [createdReportIds]);
        console.log(`[Cleanup] Removed test forensic reports: ${createdReportIds.join(", ")}`);
    }
    if (createdAutopsyIds.length > 0) {
        await pool.query("DELETE FROM autopsy_records WHERE autopsy_id = ANY($1);", [createdAutopsyIds]);
        console.log(`[Cleanup] Removed test autopsy records: ${createdAutopsyIds.join(", ")}`);
    }

    // Print Results Matrix
    console.log("\n================================================================================");
    console.log("RBAC PERMISSION MATRIX RESULTS");
    console.log("================================================================================\n");

    console.table(results.map(r => ({
        "Role": `${r.role_id}: ${r.role_name.split(' ')[0]}`,
        "View List": r.view_reports === 200 && r.view_autopsy === 200 ? "200 OK" : `F: ${r.view_reports}`,
        "Dossier": r.view_dossier === 200 ? "200 OK" : `F: ${r.view_dossier}`,
        "Download PDF": r.download_pdf === 200 ? "200 OK" : `F: ${r.download_pdf}`,
        "Create Report": r.create_report,
        "Dispatch Report": r.dispatch_report,
        "Create Autopsy": r.create_autopsy,
        "Dispatch Autopsy": r.dispatch_autopsy
    })));

    console.log("\n[Service Layer Guard Verification]");
    console.log(`- Service blocked unauthorized call with 403: ${serviceBypassBlocked ? "YES (PASSED)" : "NO (FAILED)"}`);
    console.log(`- Error message returned: "${serviceErrorMessage}"`);

    console.log("\n[Audit Logs: Recent ACCESS_DENIED entries]");
    auditRes.rows.forEach(log => {
        console.log(`  - Log #${log.audit_id} | User: ${log.employee_id || log.user_id} | ${log.details}`);
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
