const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
require("dotenv").config();

const app = require("./app");
const { startIntegrityMonitor } = require("./services/integrityScheduler");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startIntegrityMonitor(60000);
});
