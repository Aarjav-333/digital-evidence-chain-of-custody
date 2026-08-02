const userService = require("../services/userService");

const createUser = async (req, res) => {

    const result = await userService.createUser(req.body);

    res.json(result);

};

const loginUser = async (req, res) => {

    try {

        const { employee_id, password } = req.body;

        const user = await userService.loginUser(employee_id, password);

        res.status(200).json({
            success: true,
            message: "Login successful",
            data: user
        });

    } catch (error) {

        res.status(401).json({
            success: false,
            message: error.message
        });

    }

};

module.exports = {
    createUser,
    loginUser
};