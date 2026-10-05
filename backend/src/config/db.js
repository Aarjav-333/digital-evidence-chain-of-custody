const { Pool } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });
require("dotenv").config();

const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || "digital_evidence_db",
    user: process.env.DB_USER || "postgres",
    password: String(process.env.DB_PASSWORD || ""),
});

module.exports = pool;