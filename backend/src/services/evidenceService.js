const evidenceModel = require("../models/evidenceModel");

const createEvidence = async (evidenceData, uploadedBy) => {

    const latestEvidence = await evidenceModel.getLatestEvidenceNumber();

    let nextNumber = 1;

    if (latestEvidence) {

        const lastNumber = parseInt(
            latestEvidence.evidence_number.split("-")[2]
        );

        nextNumber = lastNumber + 1;

    }

    const currentYear = new Date().getFullYear();

    const evidenceNumber =
        `EV-${currentYear}-${String(nextNumber).padStart(3, "0")}`;

    const newEvidence = {
        evidence_number: evidenceNumber,
        case_id: evidenceData.case_id,
        evidence_name: evidenceData.evidence_name,
        evidence_type: evidenceData.evidence_type,
        description: evidenceData.description,
        file_name: evidenceData.file_name,
        file_path: evidenceData.file_path,
        file_hash: evidenceData.file_hash,
        encrypted_aes_key: evidenceData.encrypted_aes_key,
        uploaded_by: uploadedBy
    };

    const result = await evidenceModel.createEvidence(newEvidence);

    return {
        success: true,
        message: "Evidence created successfully",
        data: result
    };

};

module.exports = {
    createEvidence
};