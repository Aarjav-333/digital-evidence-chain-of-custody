const express = require("express");

const router = express.Router();

const {
    createCustodyLog,
    getCustodyLogs
} = require("../controllers/custodyController");

const authenticate = require("../middleware/authMiddleware");


router.post(
    "/custody",
    authenticate,
    createCustodyLog
);


router.get(
    "/custody/:evidenceId",
    authenticate,
    getCustodyLogs
);


module.exports = router;