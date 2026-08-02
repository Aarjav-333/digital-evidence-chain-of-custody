const authorizeRoles = (...allowedRoles) => {

    return (req, res, next) => {

        if (!allowedRoles.includes(req.user.role_id)) {

            return res.status(403).json({
                success: false,
                message: "Access denied"
            });

        }

        next();

    };

};

module.exports = authorizeRoles;