const alertModel = require("../models/alertModel");
const alertService = require("../services/alertService");

const getAllAlerts = async (req, res) => {
    try {
        const alerts = await alertModel.getAllAlerts();
        res.status(200).json({ success: true, data: alerts });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getAlertStats = async (req, res) => {
    try {
        const stats = await alertModel.getAlertStats();
        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const runIntegrityCheck = async (req, res) => {
    try {
        const userId = req.user ? req.user.user_id : null;
        const scanData = await alertService.scanAllEvidenceIntegrity(userId);
        const stats = await alertModel.getAlertStats();
        res.status(200).json({
            success: true,
            message: "Cryptographic integrity scan completed successfully",
            data: {
                results: scanData.results,
                scanned: scanData.scanned,
                intact: scanData.intact,
                compromised: scanData.compromised,
                new_alerts_dispatched: scanData.new_alerts_dispatched,
                stats
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const resolveAlert = async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;
        if (!req.user || !req.user.user_id) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }
        const userId = req.user.user_id;
        const resolved = await alertService.resolveAlert(id, userId, notes);
        res.status(200).json({
            success: true,
            message: "Tamper alert marked as resolved",
            data: resolved
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getAllAlerts,
    getAlertStats,
    runIntegrityCheck,
    resolveAlert
};
