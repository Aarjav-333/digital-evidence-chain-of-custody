const pool = require("../config/db");

const createAuditLog = async (
    userId,
    evidenceId,
    action,
    details
) => {

    const query = `
        INSERT INTO audit_logs
        (
            user_id,
            evidence_id,
            action,
            details
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *;
    `;

    const values = [
        userId,
        evidenceId,
        action,
        details
    ];

    const result = await pool.query(query, values);

    return result.rows[0];
};


const getAuditLogs = async (evidenceId) => {

    const query = `
        SELECT
            a.audit_id,
            a.evidence_id,
            a.user_id,
            u.full_name AS user_name,
            u.employee_id,
            a.action,
            a.details,
            a.created_at
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
    getAuditLogs
};