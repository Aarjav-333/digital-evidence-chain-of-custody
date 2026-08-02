const userService = require("../services/userService");

const createUser = async (req, res) => {

    const result = await userService.createUser(req.body);

    res.json(result);

};

module.exports = {
    createUser
};