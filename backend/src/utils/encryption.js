const crypto = require("crypto");
const fs = require("fs");

const ALGORITHM = "aes-256-gcm";

const encryptFile = (inputPath, outputPath) => {

    return new Promise((resolve, reject) => {

        const key = crypto.randomBytes(32);
        const iv = crypto.randomBytes(12);

        const cipher = crypto.createCipheriv(
            ALGORITHM,
            key,
            iv
        );

        const input = fs.createReadStream(inputPath);
        const output = fs.createWriteStream(outputPath);

        input.pipe(cipher).pipe(output);

        output.on("finish", () => {

            const authTag = cipher.getAuthTag();

            resolve({
                key: key.toString("hex"),
                iv: iv.toString("hex"),
                authTag: authTag.toString("hex")
            });

        });

        output.on("error", reject);
        input.on("error", reject);

    });
};
const encryptAESKey = (aesKeyHex) => {

    const masterKey = Buffer.from(
        process.env.MASTER_ENCRYPTION_KEY,
        "hex"
    );

    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        masterKey,
        iv
    );

    const encryptedKey = Buffer.concat([
        cipher.update(Buffer.from(aesKeyHex, "hex")),
        cipher.final()
    ]);

    const authTag = cipher.getAuthTag();

    return [
        iv.toString("hex"),
        authTag.toString("hex"),
        encryptedKey.toString("hex")
    ].join(":");
};
const decryptAESKey = (encryptedKeyData) => {

    const masterKey = Buffer.from(
        process.env.MASTER_ENCRYPTION_KEY,
        "hex"
    );

    const parts = encryptedKeyData.split(":");

    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const encryptedKey = Buffer.from(parts[2], "hex");

    const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        masterKey,
        iv
    );

    decipher.setAuthTag(authTag);

    const decryptedKey = Buffer.concat([
        decipher.update(encryptedKey),
        decipher.final()
    ]);

    return decryptedKey.toString("hex");
};


const decryptFile = (
    inputPath,
    outputPath,
    aesKeyHex,
    ivHex,
    authTagHex
) => {

    const key = Buffer.from(aesKeyHex, "hex");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const encryptedData = fs.readFileSync(inputPath);

    const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        key,
        iv
    );

    decipher.setAuthTag(authTag);

    const decryptedData = Buffer.concat([
        decipher.update(encryptedData),
        decipher.final()
    ]);

    fs.writeFileSync(outputPath, decryptedData);
};

module.exports = {
    encryptFile,
    encryptAESKey,
    decryptAESKey,
    decryptFile
};