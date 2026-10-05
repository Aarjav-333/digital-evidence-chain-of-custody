const auditModel = require("../models/auditModel");

const getAllAuditLogs = async (req, res) => {
    try {
        const result = await auditModel.getAllAuditLogs();

        res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error("Audit logs error:", error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    getAllAuditLogs
};