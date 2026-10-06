const auditService = require("../services/auditService");

/**
 * Role-based access control middleware.
 * Verifies that the authenticated user possesses one of the allowed role_ids.
 * If unauthorized, records an immutable ACCESS_DENIED audit log entry and returns HTTP 403.
 *
 * @param {...number} allowedRoles Array of allowed role IDs (e.g. 1, 4)
 */
const authorizeRoles = (...allowedRoles) => {
    return async (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role_id)) {
            const roleId = req.user ? req.user.role_id : null;
            const userId = req.user ? req.user.user_id : null;
            const empId = req.user ? (req.user.employee_id || req.user.full_name) : "Anonymous";
            const endpoint = `${req.method} ${req.originalUrl || req.baseUrl || req.path}`;

            const isReportRoute = (req.originalUrl || req.baseUrl || req.path || "").includes("report") ||
                                  (req.originalUrl || req.baseUrl || req.path || "").includes("autopsy");

            const deniedMessage = isReportRoute
                ? "Your role has view-only access to reports."
                : "Access denied. Insufficient privileges.";

            if (userId) {
                try {
                    await auditService.createAuditLog(
                        userId,
                        null,
                        "ACCESS_DENIED",
                        `[SECURITY] Unauthorized ${req.method} attempt to ${endpoint} by user ${empId} (Role ID: ${roleId || "Unknown"})`
                    );
                } catch (auditErr) {
                    console.warn("[RoleMiddleware] Failed to write access denied audit log:", auditErr.message);
                }
            }

            return res.status(403).json({
                success: false,
                error: "FORBIDDEN",
                message: deniedMessage
            });
        }

        next();
    };
};

module.exports = authorizeRoles;