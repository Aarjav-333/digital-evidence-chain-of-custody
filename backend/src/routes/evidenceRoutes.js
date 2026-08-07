const express = require("express");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

const { createEvidence } = require("../controllers/evidenceController");

const authenticate = require("../middleware/authMiddleware");

router.post(
    "/evidence",
    authenticate,
    upload.single("evidenceFile"),
    createEvidence
);
module.exports = router;