const pool = require("../config/db");

// FORENSIC REPORTS
const getAllForensicReports = async () => {
    const query = `
        SELECT 
            fr.*,
            e.evidence_number,
            e.evidence_name,
            c.case_number,
            c.case_title,
            u.full_name AS analyst_name,
            rec.full_name AS recipient_user_name
        FROM forensic_reports fr
        LEFT JOIN evidence e ON fr.evidence_id = e.evidence_id
        LEFT JOIN cases c ON fr.case_id = c.case_id
        LEFT JOIN users u ON fr.analyst_id = u.user_id
        LEFT JOIN users rec ON fr.recipient_id = rec.user_id
        ORDER BY fr.created_at DESC;
    `;
    const result = await pool.query(query);
    return result.rows;
};

const getLatestReportNumber = async () => {
    const query = `SELECT report_number FROM forensic_reports ORDER BY report_id DESC LIMIT 1`;
    const result = await pool.query(query);
    return result.rows[0];
};

const createForensicReport = async (data) => {
    const query = `
        INSERT INTO forensic_reports
        (
            report_number,
            case_id,
            evidence_id,
            analyst_id,
            report_title,
            report_type,
            tools_used,
            hash_verified,
            findings,
            artifacts_recovered,
            conclusion,
            status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'DRAFT')
        RETURNING *;
    `;
    const values = [
        data.report_number,
        data.case_id,
        data.evidence_id,
        data.analyst_id,
        data.report_title,
        data.report_type || 'EXAMINATION_REPORT',
        data.tools_used,
        data.hash_verified !== undefined ? data.hash_verified : true,
        data.findings,
        data.artifacts_recovered,
        data.conclusion
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
};

const dispatchForensicReport = async (reportId, dispatchData) => {
    const query = `
        UPDATE forensic_reports
        SET status = 'SENT',
            recipient_id = $2,
            recipient_name = $3,
            recipient_agency = $4,
            transmission_priority = $5,
            dispatch_notes = $6,
            sent_at = CURRENT_TIMESTAMP
        WHERE report_id = $1
        RETURNING *;
    `;
    const values = [
        reportId,
        dispatchData.recipient_id,
        dispatchData.recipient_name,
        dispatchData.recipient_agency,
        dispatchData.transmission_priority || 'NORMAL',
        dispatchData.dispatch_notes
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
};

// AUTOPSIES
const getAllAutopsies = async () => {
    const query = `
        SELECT 
            a.*,
            e.evidence_number,
            e.evidence_name,
            c.case_number,
            c.case_title,
            u.full_name AS examiner_name,
            rec.full_name AS recipient_user_name
        FROM autopsy_records a
        LEFT JOIN evidence e ON a.evidence_id = e.evidence_id
        LEFT JOIN cases c ON a.case_id = c.case_id
        LEFT JOIN users u ON a.examiner_id = u.user_id
        LEFT JOIN users rec ON a.recipient_id = rec.user_id
        ORDER BY a.created_at DESC;
    `;
    const result = await pool.query(query);
    return result.rows;
};

const getLatestAutopsyNumber = async () => {
    const query = `SELECT autopsy_number FROM autopsy_records ORDER BY autopsy_id DESC LIMIT 1`;
    const result = await pool.query(query);
    return result.rows[0];
};

const createAutopsy = async (data) => {
    const query = `
        INSERT INTO autopsy_records
        (
            autopsy_number,
            case_id,
            evidence_id,
            examiner_id,
            subject_name,
            device_type,
            hardware_condition,
            extraction_method,
            autopsy_findings,
            triage_summary,
            status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'COMPLETED')
        RETURNING *;
    `;
    const values = [
        data.autopsy_number,
        data.case_id,
        data.evidence_id,
        data.examiner_id,
        data.subject_name,
        data.device_type,
        data.hardware_condition,
        data.extraction_method,
        data.autopsy_findings,
        data.triage_summary
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
};

const dispatchAutopsy = async (autopsyId, dispatchData) => {
    const query = `
        UPDATE autopsy_records
        SET status = 'DISPATCHED',
            dispatched_to = $2,
            recipient_id = $3,
            dispatch_notes = $4,
            dispatched_at = CURRENT_TIMESTAMP
        WHERE autopsy_id = $1
        RETURNING *;
    `;
    const values = [
        autopsyId,
        dispatchData.dispatched_to,
        dispatchData.recipient_id,
        dispatchData.dispatch_notes
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
};

// COMPREHENSIVE CASE RECORDS FOR FORENSIC REPORT
const getCaseFullDossier = async (caseId) => {
    const caseQuery = `
        SELECT 
            c.*,
            u.full_name AS officer_name,
            u.employee_id AS officer_badge,
            u.email AS officer_email,
            cr.full_name AS created_by_name
        FROM cases c
        LEFT JOIN users u ON c.investigating_officer = u.user_id
        LEFT JOIN users cr ON c.created_by = cr.user_id
        WHERE c.case_id = $1;
    `;
    const caseRes = await pool.query(caseQuery, [caseId]);
    const caseData = caseRes.rows[0];
    if (!caseData) return null;

    const evidenceQuery = `
        SELECT 
            e.*,
            u.full_name AS uploader_name,
            u.employee_id AS uploader_badge
        FROM evidence e
        LEFT JOIN users u ON e.uploaded_by = u.user_id
        WHERE e.case_id = $1
        ORDER BY e.evidence_id ASC;
    `;
    const evidenceRes = await pool.query(evidenceQuery, [caseId]);
    const evidenceList = evidenceRes.rows;

    const custodyQuery = `
        SELECT 
            cl.*,
            e.evidence_number,
            e.evidence_name,
            fu.full_name AS from_user_name,
            fu.employee_id AS from_user_badge,
            tu.full_name AS to_user_name,
            tu.employee_id AS to_user_badge
        FROM custody_logs cl
        JOIN evidence e ON cl.evidence_id = e.evidence_id
        LEFT JOIN users fu ON cl.from_user = fu.user_id
        LEFT JOIN users tu ON cl.to_user = tu.user_id
        WHERE e.case_id = $1
        ORDER BY cl.created_at ASC;
    `;
    const custodyRes = await pool.query(custodyQuery, [caseId]);
    const custodyList = custodyRes.rows;

    const autopsyQuery = `
        SELECT 
            a.*,
            e.evidence_number,
            e.evidence_name,
            u.full_name AS examiner_name,
            rec.full_name AS recipient_user_name
        FROM autopsy_records a
        LEFT JOIN evidence e ON a.evidence_id = e.evidence_id
        LEFT JOIN users u ON a.examiner_id = u.user_id
        LEFT JOIN users rec ON a.recipient_id = rec.user_id
        WHERE a.case_id = $1 OR a.evidence_id IN (SELECT evidence_id FROM evidence WHERE case_id = $1)
        ORDER BY a.created_at DESC;
    `;
    const autopsyRes = await pool.query(autopsyQuery, [caseId]);
    const autopsyList = autopsyRes.rows;

    const reportsQuery = `
        SELECT 
            fr.*,
            e.evidence_number,
            e.evidence_name,
            u.full_name AS analyst_name,
            rec.full_name AS recipient_user_name
        FROM forensic_reports fr
        LEFT JOIN evidence e ON fr.evidence_id = e.evidence_id
        LEFT JOIN cases c ON fr.case_id = c.case_id
        LEFT JOIN users u ON fr.analyst_id = u.user_id
        LEFT JOIN users rec ON fr.recipient_id = rec.user_id
        WHERE fr.case_id = $1 OR fr.evidence_id IN (SELECT evidence_id FROM evidence WHERE case_id = $1)
        ORDER BY fr.created_at DESC;
    `;
    const reportsRes = await pool.query(reportsQuery, [caseId]);
    const reportsList = reportsRes.rows;

    const auditQuery = `
        SELECT 
            al.*,
            u.full_name AS user_name,
            u.employee_id AS user_employee_id,
            e.evidence_number,
            e.evidence_name
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.user_id
        LEFT JOIN evidence e ON al.evidence_id = e.evidence_id
        WHERE 
            al.evidence_id IN (SELECT evidence_id FROM evidence WHERE case_id = $1)
            OR al.details ILIKE '%' || (SELECT case_number FROM cases WHERE case_id = $1) || '%'
        ORDER BY al.created_at DESC;
    `;
    const auditRes = await pool.query(auditQuery, [caseId]);
    const auditList = auditRes.rows;

    const alertsQuery = `
        SELECT 
            ta.*,
            e.evidence_number,
            e.evidence_name,
            u.full_name AS resolved_by_name
        FROM tamper_alerts ta
        LEFT JOIN evidence e ON ta.evidence_id = e.evidence_id
        LEFT JOIN users u ON ta.resolved_by = u.user_id
        WHERE ta.case_id = $1 OR ta.evidence_id IN (SELECT evidence_id FROM evidence WHERE case_id = $1)
        ORDER BY ta.detected_at DESC;
    `;
    const alertsRes = await pool.query(alertsQuery, [caseId]);
    const alertsList = alertsRes.rows;

    return {
        case: caseData,
        evidence: evidenceList,
        custody: custodyList,
        autopsies: autopsyList,
        reports: reportsList,
        auditLogs: auditList,
        alerts: alertsList,
        stats: {
            evidenceCount: evidenceList.length,
            custodyEventsCount: custodyList.length,
            autopsiesCount: autopsyList.length,
            reportsCount: reportsList.length,
            auditLogsCount: auditList.length,
            alertsCount: alertsList.length,
            activeAlertsCount: alertsList.filter(a => a.status === 'ACTIVE').length
        }
    };
};

module.exports = {
    getAllForensicReports,
    getLatestReportNumber,
    createForensicReport,
    dispatchForensicReport,
    getAllAutopsies,
    getLatestAutopsyNumber,
    createAutopsy,
    dispatchAutopsy,
    getCaseFullDossier
};
