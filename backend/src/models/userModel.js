const pool = require("../config/db");

const createUser = async (userData) => {

    const {
        employee_id,
        role_id,
        password_hash,
        full_name,
        email,
        phone_number
    } = userData;

    const query = `
        INSERT INTO users (
            employee_id,
            role_id,
            password_hash,
            full_name,
            email,
            phone_number
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
    `;

    const values = [
        employee_id,
        role_id,
        password_hash,
        full_name,
        email,
        phone_number
    ];

    const result = await pool.query(query, values);

    return result.rows[0];
};

module.exports = {
    createUser
};