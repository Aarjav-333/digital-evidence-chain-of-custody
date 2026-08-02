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
const getUserByEmployeeId = async (employee_id) => {

    const query = `
        SELECT *
        FROM users
        WHERE employee_id = $1;
    `;

    const result = await pool.query(query, [employee_id]);

    return result.rows[0];

};
module.exports = {
    createUser,
    getUserByEmployeeId
};