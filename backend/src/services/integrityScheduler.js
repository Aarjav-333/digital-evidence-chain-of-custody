const alertService = require("./alertService");

let intervalId = null;

const startIntegrityMonitor = (intervalMs = 60000) => {
    if (intervalId) return;
    console.log(`[IntegrityMonitor] Started background automated file integrity monitor (every ${intervalMs / 1000}s)`);
    
    setTimeout(async () => {
        try {
            await alertService.scanAllEvidenceIntegrity();
            console.log("[IntegrityMonitor] Initial background integrity scan completed.");
        } catch (err) {
            console.error("[IntegrityMonitor] Initial scan error:", err.message);
        }
    }, 5000);

    intervalId = setInterval(async () => {
        try {
            const results = await alertService.scanAllEvidenceIntegrity();
            const issues = results.filter(r => r.status !== "INTACT");
            if (issues.length > 0) {
                console.warn(`[IntegrityMonitor] Periodic check detected ${issues.length} tamper/integrity issues!`);
            }
        } catch (err) {
            console.error("[IntegrityMonitor] Periodic check error:", err.message);
        }
    }, intervalMs);
};

const stopIntegrityMonitor = () => {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log("[IntegrityMonitor] Stopped background monitor");
    }
};

module.exports = {
    startIntegrityMonitor,
    stopIntegrityMonitor
};
