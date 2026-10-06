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
            a.email_status,
            a.email_attempts,
            a.email_last_error,
            a.email_sent_at,
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
            COUNT(*) FILTER (WHERE severity = 'HIGH' AND status = 'ACTIVE')::int AS high_alerts,
            COUNT(*) FILTER (WHERE status = 'ACTIVE' AND email_status IN ('PENDING', 'FAILED'))::int AS unsent_email_alerts
        FROM tamper_alerts;
    `;
    const result = await pool.query(query);
    return result.rows[0];
};

const createAlert = async (alertData) => {
    // Proactively check for existing active alert for duplicate suppression
    const existing = await findActiveAlert(alertData.evidence_id, alertData.alert_type, alertData.file_path);
    if (existing) {
        return { ...existing, is_new: false, already_exists: true };
    }

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
            status,
            email_status,
            email_attempts,
            email_last_error,
            email_sent_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', $9, $10, $11, $12)
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
        alertData.message,
        alertData.email_status || 'PENDING',
        alertData.email_attempts || 0,
        alertData.email_last_error || null,
        alertData.email_sent_at || null
    ];
    try {
        const result = await pool.query(query, values);
        return { ...result.rows[0], is_new: true };
    } catch (err) {
        // Unique violation (Postgres error 23505): partial unique index idx_active_tamper_alerts_unique
        if (err.code === "23505") {
            const conflictExisting = await findActiveAlert(alertData.evidence_id, alertData.alert_type, alertData.file_path);
            return conflictExisting ? { ...conflictExisting, is_new: false, already_exists: true } : null;
        }
        throw err;
    }
};

const findActiveAlert = async (evidenceId, alertType, filePath = null) => {
    let query;
    let params;

    if (evidenceId !== null && evidenceId !== undefined) {
        query = `
            SELECT 
                alert_id,
                evidence_id,
                case_id,
                alert_type,
                severity,
                stored_hash,
                detected_hash,
                file_path,
                message,
                status,
                email_status,
                email_attempts,
                email_last_error,
                email_sent_at,
                detected_at
            FROM tamper_alerts 
            WHERE evidence_id = $1 AND alert_type = $2 AND status = 'ACTIVE'
            LIMIT 1;
        `;
        params = [evidenceId, alertType];
    } else if (filePath) {
        query = `
            SELECT 
                alert_id,
                evidence_id,
                case_id,
                alert_type,
                severity,
                stored_hash,
                detected_hash,
                file_path,
                message,
                status,
                email_status,
                email_attempts,
                email_last_error,
                email_sent_at,
                detected_at
            FROM tamper_alerts 
            WHERE evidence_id IS NULL AND alert_type = $1 AND file_path = $2 AND status = 'ACTIVE'
            LIMIT 1;
        `;
        params = [alertType, filePath];
    } else {
        query = `
            SELECT 
                alert_id,
                evidence_id,
                case_id,
                alert_type,
                severity,
                stored_hash,
                detected_hash,
                file_path,
                message,
                status,
                email_status,
                email_attempts,
                email_last_error,
                email_sent_at,
                detected_at
            FROM tamper_alerts 
            WHERE evidence_id IS NULL AND alert_type = $1 AND status = 'ACTIVE'
            LIMIT 1;
        `;
        params = [alertType];
    }

    const result = await pool.query(query, params);
    return result.rows[0];
};

const updateAlertEmailDispatch = async (alertId, { email_status, email_attempts, email_last_error, email_sent_at }) => {
    const query = `
        UPDATE tamper_alerts
        SET email_status = COALESCE($2, email_status),
            email_attempts = COALESCE($3, email_attempts),
            email_last_error = $4,
            email_sent_at = COALESCE($5, email_sent_at)
        WHERE alert_id = $1
        RETURNING *;
    `;
    const values = [
        alertId,
        email_status,
        email_attempts,
        email_last_error,
        email_sent_at
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
};

const getUnsentActiveAlerts = async (maxAttempts = 5) => {
    const query = `
        SELECT 
            a.*,
            e.evidence_number,
            e.evidence_name,
            c.case_number
        FROM tamper_alerts a
        LEFT JOIN evidence e ON a.evidence_id = e.evidence_id
        LEFT JOIN cases c ON a.case_id = c.case_id
        WHERE a.status = 'ACTIVE' 
          AND a.email_status IN ('PENDING', 'FAILED')
          AND (a.email_attempts IS NULL OR a.email_attempts < $1)
        ORDER BY a.alert_id ASC;
    `;
    const result = await pool.query(query, [maxAttempts]);
    return result.rows;
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
    updateAlertEmailDispatch,
    getUnsentActiveAlerts,
    resolveAlert
};
