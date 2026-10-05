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
    if (!encryptedKeyData || typeof encryptedKeyData !== "string") {
        throw new Error("Invalid or missing encrypted AES key data");
    }

    const parts = encryptedKeyData.split(":");
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
        throw new Error("Encrypted AES key payload format is invalid or incomplete");
    }

    const masterKeyHex = process.env.MASTER_ENCRYPTION_KEY;
    if (!masterKeyHex) {
        throw new Error("MASTER_ENCRYPTION_KEY environment variable is missing");
    }

    const masterKey = Buffer.from(masterKeyHex, "hex");
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
    if (!inputPath || !fs.existsSync(inputPath)) {
        throw new Error(`Encrypted source file not found at ${inputPath}`);
    }
    if (!aesKeyHex || !ivHex || !authTagHex) {
        throw new Error("Missing required decryption parameters (AES key, IV, or Auth Tag)");
    }

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