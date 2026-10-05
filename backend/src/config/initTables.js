const fs = require("fs");
const path = require("path");
const pool = require("./db");

const initDatabase = async () => {
    try {
        const schemaPath = path.resolve(__dirname, "../../../database/schema.sql");
        const seedPath = path.resolve(__dirname, "../../../database/seed_demo_data.sql");

        console.log("[DB Init] Executing schema.sql...");
        const schemaSql = fs.readFileSync(schemaPath, "utf-8");
        await pool.query(schemaSql);
        console.log("[DB Init] Tables and indexes initialized successfully.");

        if (fs.existsSync(seedPath)) {
            console.log("[DB Init] Seeding demo roles and users...");
            const seedSql = fs.readFileSync(seedPath, "utf-8");
            await pool.query(seedSql);
            console.log("[DB Init] Demo data seeded successfully.");
        }

        await pool.end();
        console.log("[DB Init] Done.");
    } catch (error) {
        console.error("[DB Init] Failed to initialize database:", error);
        process.exit(1);
    }
};

if (require.main === module) {
    initDatabase();
}

module.exports = initDatabase;
