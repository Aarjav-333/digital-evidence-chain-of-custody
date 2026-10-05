const pool = require("../config/db");

const getLatestCaseNumber = async () => {

    const query = `
        SELECT case_number
        FROM cases
        ORDER BY case_id DESC
        LIMIT 1;
    `;

    const result = await pool.query(query);

    return result.rows[0];

};


const createCase = async (caseData) => {

    const query = `
        INSERT INTO cases
        (
            case_number,
            case_title,
            case_description,
            investigating_officer,
            created_by,
            status
        )
        VALUES
        ($1, $2, $3, $4, $5, $6)
        RETURNING *;
    `;

    const values = [
        caseData.case_number,
        caseData.case_title,
        caseData.case_description,
        caseData.investigating_officer,
        caseData.created_by,
        caseData.status
    ];

    const result = await pool.query(query, values);

    return result.rows[0];

};


// GET ALL CASES
const getAllCases = async () => {

    const query = `
        SELECT
            case_id,
            case_number,
            case_title,
            case_description,
            investigating_officer,
            created_by,
            status,
            created_at
        FROM cases
        ORDER BY case_id DESC;
    `;

    const result = await pool.query(query);

    return result.rows;

};


module.exports = {
    getLatestCaseNumber,
    createCase,
    getAllCases
};