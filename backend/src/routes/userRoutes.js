const express = require("express");
const router = express.Router();

const {
    createUser,
    loginUser,
    getAllUsers
} = require("../controllers/userController");

const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

// Only System Administrator (role_id = 1) can create users
router.post(
    "/users",
    authenticate,
    authorizeRoles(1),
    createUser
);

// Authenticated users can list system users (for custody and report dispatch recipients)
router.get("/users", authenticate, getAllUsers);

// Anyone can log in
router.post("/login", loginUser);

// Any logged-in user can view their own profile
router.get("/profile", authenticate, (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});

module.exports = router;
