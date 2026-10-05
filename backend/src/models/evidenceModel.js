const pool = require("../config/db");

const getLatestEvidenceNumber = async () => {

    const query = `
        SELECT evidence_number
        FROM evidence
        ORDER BY evidence_id DESC
        LIMIT 1;
    `;

    const result = await pool.query(query);

    return result.rows[0];

};

const createEvidence = async (evidenceData) => {

    const query = `
        INSERT INTO evidence
        (
            evidence_number,
            case_id,
            evidence_name,
            evidence_type,
            description,
            file_name,
            file_path,
            file_hash,
            encrypted_aes_key,
            encryption_iv,
            encryption_auth_tag,
            uploaded_by
        )
        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING *;
    `;

    const values = [
        evidenceData.evidence_number,
        evidenceData.case_id,
        evidenceData.evidence_name,
        evidenceData.evidence_type,
        evidenceData.description,
        evidenceData.file_name,
        evidenceData.file_path,
        evidenceData.file_hash,
        evidenceData.encrypted_aes_key,
        evidenceData.encryption_iv,
        evidenceData.encryption_auth_tag,
        evidenceData.uploaded_by
    ];

    const result = await pool.query(query, values);

    return result.rows[0];
};
const getEvidenceById = async (evidenceId) => {

    const query = `
        SELECT
            evidence_id,
            evidence_number,
            file_name,
            file_path,
            file_hash,
            encrypted_aes_key,
            encryption_iv,
            encryption_auth_tag
        FROM evidence
        WHERE evidence_id = $1;
    `;

    const result = await pool.query(query, [evidenceId]);

    return result.rows[0];
};
const getAllEvidence = async () => {

    const query = `
        SELECT
            e.evidence_id,
            e.evidence_number,
            e.case_id,
            c.case_number,
            c.case_title,
            e.evidence_name,
            e.evidence_type,
            e.description,
            e.file_name,
            e.file_hash,
            e.uploaded_by,
            e.uploaded_at
        FROM evidence e
        LEFT JOIN cases c
            ON e.case_id = c.case_id
        ORDER BY e.evidence_id DESC;
    `;

    const result = await pool.query(query);

    return result.rows;
};


module.exports = {
    createEvidence,
    getLatestEvidenceNumber,
    getEvidenceById,
    getAllEvidence
};