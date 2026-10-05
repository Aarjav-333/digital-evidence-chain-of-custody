const express = require("express");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

const {
    createEvidence,
    verifyEvidence,
    decryptEvidence,
    getAllEvidence
} = require("../controllers/evidenceController");

const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

// Upload evidence: Admin (1), Police Officer (2), Case Manager (3)
router.post(
    "/evidence",
    authenticate,
    authorizeRoles(1, 2, 3),
    upload.single("evidenceFile"),
    createEvidence
);

// Verify hash integrity: All authenticated roles
router.get(
    "/evidence/:evidenceId/verify",
    authenticate,
    authorizeRoles(1, 2, 3, 4),
    verifyEvidence
);

// Decrypt and stream: System Administrator (1) & Forensic Analyst (4)
router.get(
    "/evidence/:evidenceId/decrypt",
    authenticate,
    authorizeRoles(1, 4),
    decryptEvidence
);

// View evidence inventory: All authenticated roles
router.get(
    "/evidence",
    authenticate,
    authorizeRoles(1, 2, 3, 4),
    getAllEvidence
);

module.exports = router;