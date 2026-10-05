const pool = require("../config/db");
const auditService = require("./auditService");

const createCustodyLog = async (custodyData) => {

    const {
        evidence_id,
        from_user,
        to_user,
        action,
        remarks
    } = custodyData;

    const query = `
        INSERT INTO custody_logs
        (
            evidence_id,
            from_user,
            to_user,
            action,
            remarks
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
    `;

    const values = [
        evidence_id,
        from_user,
        to_user,
        action,
        remarks
    ];
const result = await pool.query(query, values);

const custodyLog = result.rows[0];

await auditService.createAuditLog(
    from_user,
    evidence_id,
    action,
    `Custody action: ${action}. ${remarks || ""}`
);

return custodyLog;
};

const getCustodyLogs = async (evidenceId) => {

    const query = `
        SELECT
            c.custody_id,
            c.evidence_id,

            c.from_user,
            from_u.full_name AS from_user_name,

            c.to_user,
            to_u.full_name AS to_user_name,

            c.action,
            c.remarks,
            c.created_at

        FROM custody_logs c

        LEFT JOIN users from_u
            ON c.from_user = from_u.user_id

        LEFT JOIN users to_u
            ON c.to_user = to_u.user_id

        WHERE c.evidence_id = $1

        ORDER BY c.created_at ASC;
    `;

    const result = await pool.query(query, [evidenceId]);

    return result.rows;
};

module.exports = {
    createCustodyLog,
    getCustodyLogs
};