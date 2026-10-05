const reportModel = require("../models/reportModel");
const reportService = require("../services/reportService");
const forensicPdfService = require("../services/forensicPdfService");

const getAllForensicReports = async (req, res) => {
    try {
        const reports = await reportModel.getAllForensicReports();
        res.status(200).json({ success: true, data: reports });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const createForensicReport = async (req, res) => {
    try {
        if (!req.user || !req.user.user_id) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }
        const userId = req.user.user_id;
        const report = await reportService.createForensicReport(req.body, userId);
        res.status(201).json({ success: true, message: "Forensic report created successfully", data: report });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const dispatchForensicReport = async (req, res) => {
    try {
        if (!req.user || !req.user.user_id) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }
        const { id } = req.params;
        const userId = req.user.user_id;
        const result = await reportService.dispatchForensicReport(id, req.body, userId);
        res.status(200).json({ success: true, message: "Report dispatched successfully", data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getAllAutopsies = async (req, res) => {
    try {
        const autopsies = await reportModel.getAllAutopsies();
        res.status(200).json({ success: true, data: autopsies });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const createAutopsy = async (req, res) => {
    try {
        if (!req.user || !req.user.user_id) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }
        const userId = req.user.user_id;
        const autopsy = await reportService.createAutopsy(req.body, userId);
        res.status(201).json({ success: true, message: "Autopsy record logged successfully", data: autopsy });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const dispatchAutopsy = async (req, res) => {
    try {
        if (!req.user || !req.user.user_id) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }
        const { id } = req.params;
        const userId = req.user.user_id;
        const result = await reportService.dispatchAutopsy(id, req.body, userId);
        res.status(200).json({ success: true, message: "Autopsy dispatched successfully", data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getCaseDossier = async (req, res) => {
    try {
        const { caseId } = req.params;
        const dossier = await reportModel.getCaseFullDossier(caseId);
        if (!dossier) {
            return res.status(404).json({ success: false, message: "Case not found" });
        }
        res.status(200).json({ success: true, data: dossier });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const downloadCaseForensicPdf = async (req, res) => {
    try {
        const { caseId } = req.params;

        if (!req.user || !req.user.user_id) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="forensic-report-${caseId}.pdf"`
        );

        await forensicPdfService.generateCaseForensicPdf(caseId, res);
    } catch (error) {
        console.error("Forensic PDF generation error:", error);

        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to generate forensic PDF"
            });
        }

        res.end();
    }
};

module.exports = {
    getAllForensicReports,
    createForensicReport,
    dispatchForensicReport,
    getAllAutopsies,
    createAutopsy,
    dispatchAutopsy,
    getCaseDossier,
    downloadCaseForensicPdf
};
