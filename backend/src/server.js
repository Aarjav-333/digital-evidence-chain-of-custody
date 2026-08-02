const app = require("./app");
const pool = require("./config/db");

const PORT = 3000;

async function startServer() {

    try {

        await pool.query("SELECT NOW()");

        console.log("✅ PostgreSQL Connected");

        app.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
        });

    } catch (err) {

        console.error(err);

    }

}

startServer();