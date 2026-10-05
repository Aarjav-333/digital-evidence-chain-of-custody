const pool = require("../config/db");

const getAllAlerts = async () => {
    const query = `
        SELECT 
            a.alert_id,
            a.evidence_id,
            a.case_id,
            a.alert_type,
            a.severity,
            a.stored_hash,
            a.detected_hash,
            a.file_path,
            a.message,
            a.status,
            a.detected_at,
            a.resolved_by,
            a.resolved_at,
            a.resolution_notes,
            e.evidence_number,
            e.evidence_name,
            e.file_name,
            c.case_number,
            c.case_title,
            u.full_name AS resolved_by_name
        FROM tamper_alerts a
        LEFT JOIN evidence e ON a.evidence_id = e.evidence_id
        LEFT JOIN cases c ON a.case_id = c.case_id
        LEFT JOIN users u ON a.resolved_by = u.user_id
        ORDER BY 
            CASE WHEN a.status = 'ACTIVE' THEN 1 ELSE 2 END,
            a.detected_at DESC;
    `;
    const result = await pool.query(query);
    return result.rows;
};

const getAlertStats = async () => {
    const query = `
        SELECT 
            COUNT(*)::int AS total_alerts,
            COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active_alerts,
            COUNT(*) FILTER (WHERE status = 'RESOLVED')::int AS resolved_alerts,
            COUNT(*) FILTER (WHERE severity = 'CRITICAL' AND status = 'ACTIVE')::int AS critical_alerts,
            COUNT(*) FILTER (WHERE severity = 'HIGH' AND status = 'ACTIVE')::int AS high_alerts
        FROM tamper_alerts;
    `;
    const result = await pool.query(query);
    return result.rows[0];
};

const createAlert = async (alertData) => {
    const query = `
        INSERT INTO tamper_alerts
        (
            evidence_id,
            case_id,
            alert_type,
            severity,
            stored_hash,
            detected_hash,
            file_path,
            message,
            status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE')
        RETURNING *;
    `;
    const values = [
        alertData.evidence_id,
        alertData.case_id,
        alertData.alert_type,
        alertData.severity || 'CRITICAL',
        alertData.stored_hash,
        alertData.detected_hash,
        alertData.file_path,
        alertData.message
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
};

const findActiveAlert = async (evidenceId, alertType) => {
    const query = `
        SELECT alert_id 
        FROM tamper_alerts 
        WHERE evidence_id = $1 AND alert_type = $2 AND status = 'ACTIVE'
        LIMIT 1;
    `;
    const result = await pool.query(query, [evidenceId, alertType]);
    return result.rows[0];
};

const resolveAlert = async (alertId, userId, notes) => {
    const query = `
        UPDATE tamper_alerts
        SET status = 'RESOLVED',
            resolved_by = $2,
            resolved_at = CURRENT_TIMESTAMP,
            resolution_notes = $3
        WHERE alert_id = $1
        RETURNING *;
    `;
    const result = await pool.query(query, [alertId, userId, notes || 'Resolved by administrator']);
    return result.rows[0];
};

module.exports = {
    getAllAlerts,
    getAlertStats,
    createAlert,
    findActiveAlert,
    resolveAlert
};
