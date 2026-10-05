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

const getUserByEmployeeId = async (identifier) => {
    const query = `
        SELECT 
            u.user_id,
            u.employee_id,
            u.role_id,
            u.password_hash,
            u.full_name,
            u.email,
            u.phone_number,
            u.is_active,
            r.role_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.role_id
        WHERE 
            LOWER(u.employee_id) = LOWER($1)
            OR LOWER(u.email) = LOWER($1)
            OR (LOWER($1) IN ('admin', 'administrator', 'sysadmin') AND u.role_id = 1)
        LIMIT 1;
    `;
    const result = await pool.query(query, [identifier]);
    return result.rows[0];
};

const getAllUsers = async () => {
    const query = `
        SELECT 
            u.user_id,
            u.employee_id,
            u.role_id,
            u.full_name,
            u.email,
            u.phone_number,
            u.is_active,
            r.role_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.role_id
        ORDER BY u.role_id ASC, u.full_name ASC;
    `;
    const result = await pool.query(query);
    return result.rows;
};

module.exports = {
    createUser,
    getUserByEmployeeId,
    getAllUsers
};
