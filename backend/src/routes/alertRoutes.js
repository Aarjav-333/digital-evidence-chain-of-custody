const express = require("express");
const router = express.Router();
const alertController = require("../controllers/alertController");
const authenticate = require("../middleware/authMiddleware");

router.get("/alerts", authenticate, alertController.getAllAlerts);
router.get("/alerts/stats", authenticate, alertController.getAlertStats);
router.post("/alerts/run-check", authenticate, alertController.runIntegrityCheck);
router.put("/alerts/:id/resolve", authenticate, alertController.resolveAlert);

module.exports = router;
