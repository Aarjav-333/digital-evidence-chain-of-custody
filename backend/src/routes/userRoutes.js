const express = require("express");

const router = express.Router();

const {
    createUser,
    loginUser
} = require("../controllers/userController");

const authenticate = require("../middleware/authMiddleware");

router.post("/users", createUser);
router.post("/login", loginUser);
router.get("/profile", authenticate, (req, res) => {

    res.json({
        success: true,
        user: req.user
    });

});

module.exports = router;