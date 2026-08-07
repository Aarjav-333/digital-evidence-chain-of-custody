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
            uploaded_by
        )
        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
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
        evidenceData.uploaded_by
    ];

    const result = await pool.query(query, values);

    return result.rows[0];

};

module.exports = {
    getLatestEvidenceNumber,
    createEvidence
};