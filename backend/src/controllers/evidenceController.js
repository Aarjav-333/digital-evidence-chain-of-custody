const evidenceService = require("../services/evidenceService");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const {
    encryptFile,
    encryptAESKey
} = require("../utils/encryption");

const createEvidence = async (req, res) => {
    try {
        const uploadedBy = req.user.user_id;
        const originalPath = req.file.path;
        const fileBuffer = fs.readFileSync(originalPath);

        // Generate SHA-256 hash of original unencrypted evidence
        const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

        const encryptedDirectory = path.join("uploads", "encrypted");
        if (!fs.existsSync(encryptedDirectory)) {
            fs.mkdirSync(encryptedDirectory, { recursive: true });
        }

        const encryptedFileName = req.file.filename + ".enc";
        const encryptedPath = path.join(encryptedDirectory, encryptedFileName);

        // Encrypt evidence file with AES-256-GCM
        const encryptionData = await encryptFile(originalPath, encryptedPath);

        // Wrap AES key with master key
        const encryptedAESKey = encryptAESKey(encryptionData.key);

        // Delete the unencrypted original upload immediately
        fs.unlinkSync(originalPath);

        const evidenceData = {
            case_id: req.body.case_id,
            evidence_name: req.body.evidence_name,
            evidence_type: req.body.evidence_type,
            description: req.body.description,
            file_name: req.file.filename,
            file_path: encryptedPath,
            file_hash: fileHash,
            encrypted_aes_key: encryptedAESKey,
            encryption_iv: encryptionData.iv,
            encryption_auth_tag: encryptionData.authTag
        };

        const result = await evidenceService.createEvidence(evidenceData, uploadedBy);
        res.status(201).json(result);
    } catch (error) {
        console.error("Create evidence error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const verifyEvidence = async (req, res) => {
    try {
        const evidenceId = req.params.evidenceId;
        const userId = req.user.user_id;
        const result = await evidenceService.verifyEvidence(evidenceId, userId);
        res.status(200).json({
            success: true,
            message: "Evidence integrity checked successfully",
            data: result
        });
    } catch (error) {
        console.error("Verify evidence error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const decryptEvidence = async (req, res) => {
    let tempPathToClean = null;
    try {
        const evidenceId = req.params.evidenceId;
        if (!req.user || !req.user.user_id) {
            return res.status(401).json({ success: false, error: "AUTH_REQUIRED", message: "Authentication required" });
        }
        const userId = req.user.user_id;

        const result = await evidenceService.decryptEvidence(evidenceId, userId);
        tempPathToClean = result.tempFilePath;

        const safeFilename = encodeURIComponent(result.downloadFileName);
        res.setHeader("Content-Disposition", `attachment; filename="${result.downloadFileName}"; filename*=UTF-8''${safeFilename}`);
        res.setHeader("Content-Type", "application/octet-stream");
        if (result.isLegacy) {
            res.setHeader("X-Evidence-Legacy", "true");
        }

        const cleanupTempFile = () => {
            if (tempPathToClean && fs.existsSync(tempPathToClean)) {
                try {
                    fs.unlinkSync(tempPathToClean);
                } catch (cleanupErr) {
                    console.error("Temp file cleanup error:", cleanupErr.message);
                }
                tempPathToClean = null;
            }
        };

        res.on("finish", cleanupTempFile);
        res.on("close", cleanupTempFile);
        req.on("aborted", cleanupTempFile);

        const fileStream = fs.createReadStream(tempPathToClean);
        fileStream.on("error", (streamErr) => {
            cleanupTempFile();
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: "STREAM_ERROR", message: streamErr.message });
            }
        });

        fileStream.pipe(res);
    } catch (error) {
        if (tempPathToClean && fs.existsSync(tempPathToClean)) {
            try { fs.unlinkSync(tempPathToClean); } catch (_) {}
        }
        console.error("Decrypt evidence error:", error.message);
        const statusCode = error.status || 500;
        res.status(statusCode).json({
            success: false,
            error: error.code || "DECRYPTION_ERROR",
            message: error.message || "Failed to decrypt evidence."
        });
    }
};

const getAllEvidence = async (req, res) => {
    try {
        const result = await evidenceService.getAllEvidence();
        res.status(200).json(result);
    } catch (error) {
        console.error("Get all evidence error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createEvidence,
    verifyEvidence,
    decryptEvidence,
    getAllEvidence
};
