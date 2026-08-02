const bcrypt = require("bcrypt");
const userModel = require("../models/userModel");

const createUser = async (userData) => {

    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const newUser = {
        employee_id: userData.employee_id,
        role_id: userData.role_id,
        password_hash: hashedPassword,
        full_name: userData.full_name,
        email: userData.email,
        phone_number: userData.phone_number
    };

    const result = await userModel.createUser(newUser);

    return {
        success: true,
        message: "User created successfully",
        data: result
    };

};

module.exports = {
    createUser
};