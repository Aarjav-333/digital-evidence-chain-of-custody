const custodyService = require("../services/custodyService");

const createCustodyLog = async (req, res) => {

    try {

        const fromUser = req.user.user_id;

        const custodyData = {
            evidence_id: req.body.evidence_id,
            from_user: fromUser,
            to_user: req.body.to_user,
            action: req.body.action,
            remarks: req.body.remarks
        };

        const result = await custodyService.createCustodyLog(
            custodyData
        );

        res.status(201).json({
            success: true,
            message: "Custody log created successfully",
            data: result
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    }
};


const getCustodyLogs = async (req, res) => {

    try {

        const evidenceId = req.params.evidenceId;

        const result = await custodyService.getCustodyLogs(
            evidenceId
        );

        res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    }
};


module.exports = {
    createCustodyLog,
    getCustodyLogs
};