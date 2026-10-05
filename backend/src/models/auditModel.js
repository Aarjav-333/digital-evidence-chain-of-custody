const pool = require("../config/db");

const getAllAuditLogs = async () => {
    const query = `
        SELECT 
            a.audit_id,
            a.user_id,
            COALESCE(u.full_name, 'SYSTEM') AS user_name,
            COALESCE(u.employee_id, 'SYSTEM') AS employee_id,
            a.evidence_id,
            e.evidence_number,
            a.action,
            a.details,
            a.created_at
        FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.user_id
        LEFT JOIN evidence e ON a.evidence_id = e.evidence_id
        ORDER BY a.created_at DESC;
    `;
    const result = await pool.query(query);
    return result.rows;
};

module.exports = {
    getAllAuditLogs
};