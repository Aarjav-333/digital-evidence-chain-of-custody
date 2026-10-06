const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

// Deterministic Forensic PDF Report Download (System Admin: 1, Police Officer: 2, Case Manager: 3, Forensic Officer: 4)
router.get(
    "/reports/forensic/:caseId/download",
    authenticate,
    authorizeRoles(1, 2, 3, 4),
    reportController.downloadCaseForensicPdf
);

// Reports - View list open to all roles (1-4); authoring and dispatch restricted to Forensic Officer (4)
router.get("/reports/forensic", authenticate, reportController.getAllForensicReports);
router.post("/reports/forensic", authenticate, authorizeRoles(4), reportController.createForensicReport);
router.post("/reports/forensic/:id/dispatch", authenticate, authorizeRoles(4), reportController.dispatchForensicReport);

// Autopsies - View list open to all roles (1-4); creation and dispatch restricted to Forensic Officer (4)
router.get("/reports/autopsy", authenticate, reportController.getAllAutopsies);
router.post("/reports/autopsy", authenticate, authorizeRoles(4), reportController.createAutopsy);
router.post("/reports/autopsy/:id/dispatch", authenticate, authorizeRoles(4), reportController.dispatchAutopsy);

// Full Case Dossier - View open to all authenticated roles
router.get("/cases/:caseId/dossier", authenticate, reportController.getCaseDossier);

module.exports = router;
