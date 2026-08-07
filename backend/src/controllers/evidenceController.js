const evidenceService = require("../services/evidenceService");

const createEvidence = async (req, res) => {

    try {

        const uploadedBy = req.user.user_id;

        const evidenceData = {
            case_id: req.body.case_id,
            evidence_name: req.body.evidence_name,
            evidence_type: req.body.evidence_type,
            description: req.body.description,

            file_name: req.file.filename,
            file_path: req.file.path,

            file_hash: "temporary_hash",
            encrypted_aes_key: "temporary_key"
        };

        const result = await evidenceService.createEvidence(
            evidenceData,
            uploadedBy
        );

        res.status(201).json(result);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

module.exports = {
    createEvidence
};