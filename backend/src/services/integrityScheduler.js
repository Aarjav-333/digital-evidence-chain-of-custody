const alertService = require("./alertService");

let intervalId = null;

const getIntervalMs = (defaultMs = 60000) => {
    const envMinutes = parseFloat(process.env.INTEGRITY_SCAN_MINUTES);
    if (!isNaN(envMinutes) && envMinutes > 0) {
        return Math.round(envMinutes * 60 * 1000);
    }
    return defaultMs;
};

const getFullScanIntervalMs = () => {
    const mins = parseFloat(process.env.INTEGRITY_FULL_SCAN_MINUTES);
    if (!isNaN(mins) && mins > 0) {
        return Math.round(mins * 60 * 1000);
    }
    return 60 * 60 * 1000;
};

const startIntegrityMonitor = (customIntervalMs = null) => {
    if (intervalId) return;

    const intervalMs = customIntervalMs || getIntervalMs(60000);
    const intervalSeconds = Math.round(intervalMs / 1000);
    const fullScanMinutes = Math.round(getFullScanIntervalMs() / 60000);
    console.log(`[IntegrityMonitor] Started background automated file integrity monitor (lightweight: ${intervalSeconds}s, full rehash: ${fullScanMinutes}m)`);
    
    setTimeout(async () => {
        try {
            const initialSummary = await alertService.scanAllEvidenceIntegrity(null, true);
            if (initialSummary && initialSummary.already_running) {
                console.log("[IntegrityMonitor] Initial scan skipped: concurrent scan already running.");
            } else {
                console.log("[IntegrityMonitor] Initial full cryptographic baseline scan completed.");
            }
        } catch (err) {
            console.error("[IntegrityMonitor] Initial scan error:", err.message);
        }
    }, 5000);

    intervalId = setInterval(async () => {
        try {
            const summary = await alertService.scanAllEvidenceIntegrity();
            if (summary && summary.already_running) {
                console.log("[IntegrityMonitor] Periodic scan skipped: another scan is currently active.");
                return;
            }

            const scanList = Array.isArray(summary) ? summary : (summary && summary.results) || [];
            // Stop counting LEGACY_SEED or system key unwrap issues as exhibit tamper anomalies in scheduler log
            const issues = scanList.filter(r => r.status !== "INTACT" && r.status !== "LEGACY_SEED" && r.status !== "KEY_UNWRAP_FAILED");
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
    stopIntegrityMonitor,
    getIntervalMs
};
