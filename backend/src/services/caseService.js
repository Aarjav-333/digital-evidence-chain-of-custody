const caseModel = require("../models/caseModel");

const createCase = async (caseData, createdBy) => {

    // Get the latest case number
    const latestCase = await caseModel.getLatestCaseNumber();

    let nextNumber = 1;

    if (latestCase) {

        const lastNumber = parseInt(
            latestCase.case_number.split("-")[2]
        );

        nextNumber = lastNumber + 1;

    }

    const currentYear = new Date().getFullYear();

    const caseNumber =
        `CASE-${currentYear}-${String(nextNumber).padStart(3, "0")}`;

    const newCase = {
        case_number: caseNumber,
        case_title: caseData.case_title,
        case_description: caseData.case_description,
        investigating_officer: caseData.investigating_officer,
        created_by: createdBy,
        status: "OPEN"
    };

    const result = await caseModel.createCase(newCase);

    return {
        success: true,
        message: "Case created successfully",
        data: result
    };

};

module.exports = {
    createCase
};