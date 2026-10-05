const caseService = require("../services/caseService");

const createCase = async (req, res) => {

    try {

        const createdBy = req.user.user_id;

        const result = await caseService.createCase(
            req.body,
            createdBy
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


// GET ALL CASES
const getAllCases = async (req, res) => {

    try {

        const result = await caseService.getAllCases();

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
    createCase,
    getAllCases
};