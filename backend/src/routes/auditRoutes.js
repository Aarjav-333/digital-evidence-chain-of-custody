const express = require("express");

const router = express.Router();

const {
    getAllAuditLogs
} = require("../controllers/auditController");

const authenticate = require("../middleware/authMiddleware");

router.get(
    "/audit-logs",
    authenticate,
    getAllAuditLogs
);

module.exports = router;