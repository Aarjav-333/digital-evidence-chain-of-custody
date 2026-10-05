const app = require("./app");
const { startIntegrityMonitor } = require("./services/integrityScheduler");
require("dotenv").config();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startIntegrityMonitor(60000);
});
