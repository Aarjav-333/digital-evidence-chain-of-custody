const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

// Deterministic Forensic PDF Report Download (System Admin, Case Manager, Forensic Analyst)
router.get(
    "/reports/forensic/:caseId/download",
    authenticate,
    authorizeRoles(1, 3, 4),
    reportController.downloadCaseForensicPdf
);

// Reports
router.get("/reports/forensic", authenticate, reportController.getAllForensicReports);
router.post("/reports/forensic", authenticate, reportController.createForensicReport);
router.post("/reports/forensic/:id/dispatch", authenticate, reportController.dispatchForensicReport);

// Autopsies
router.get("/reports/autopsy", authenticate, reportController.getAllAutopsies);
router.post("/reports/autopsy", authenticate, reportController.createAutopsy);
router.post("/reports/autopsy/:id/dispatch", authenticate, reportController.dispatchAutopsy);

// Full Case Dossier
router.get("/cases/:caseId/dossier", authenticate, reportController.getCaseDossier);

module.exports = router;
