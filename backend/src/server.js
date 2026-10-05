const fs = require("fs");
const path = require("path");
const envPath = path.resolve(__dirname, "../.env");
require("dotenv").config({ path: envPath });
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
require("dotenv").config();

// Auto-reload environment variables whenever backend/.env is edited
if (fs.existsSync(envPath)) {
    fs.watchFile(envPath, { interval: 1000 }, () => {
        require("dotenv").config({ path: envPath, override: true });
        console.log("[Server] Environment configuration dynamically reloaded from backend/.env");
    });
}

const app = require("./app");
const { startIntegrityMonitor } = require("./services/integrityScheduler");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startIntegrityMonitor(60000);
});
