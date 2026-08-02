const express = require("express");

const router = express.Router();

const { createCase } = require("../controllers/caseController");

const authenticate = require("../middleware/authMiddleware");

router.post(
    "/cases",
    authenticate,
    createCase
);

module.exports = router;