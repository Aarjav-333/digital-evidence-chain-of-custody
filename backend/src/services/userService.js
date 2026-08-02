const jwt = require("jsonwebtoken");
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
const loginUser = async (employee_id, password) => {

    // Find the user
    const user = await userModel.getUserByEmployeeId(employee_id);

    // User doesn't exist
    if (!user) {
        throw new Error("Invalid Employee ID or Password");
    }

    // Compare entered password with stored hash
    const isMatch = await bcrypt.compare(password, user.password_hash);

    // Wrong password
    if (!isMatch) {
        throw new Error("Invalid Employee ID or Password");
    }

    const token = jwt.sign(
    {
        user_id: user.user_id,
        employee_id: user.employee_id,
        role_id: user.role_id
    },
    process.env.JWT_SECRET,
    {
        expiresIn: process.env.JWT_EXPIRES_IN
    }
);
return {
    token,
    user: {
        user_id: user.user_id,
        employee_id: user.employee_id,
        role_id: user.role_id,
        full_name: user.full_name,
        email: user.email,
        phone_number: user.phone_number,
        is_active: user.is_active
    }
};

};
module.exports = {
    createUser,
    loginUser
};