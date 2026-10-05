const evidenceModel = require("../models/evidenceModel");
const auditService = require("./auditService");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const {
    decryptAESKey,
    decryptFile
} = require("../utils/encryption");

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
    const evidenceNumber = `EV-${currentYear}-${String(nextNumber).padStart(3, "0")}`;

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
        encryption_iv: evidenceData.encryption_iv,
        encryption_auth_tag: evidenceData.encryption_auth_tag,
        uploaded_by: uploadedBy
    };

    const result = await evidenceModel.createEvidence(newEvidence);

    await auditService.createAuditLog(
        uploadedBy,
        result.evidence_id,
        "UPLOADED",
        `Evidence uploaded: ${result.evidence_number}`
    );

    return {
        success: true,
        message: "Evidence created successfully",
        data: result
    };
};

const resolveEvidenceFilePath = (storedPath) => {
    if (!storedPath) return null;
    if (path.isAbsolute(storedPath) && fs.existsSync(storedPath)) return storedPath;

    const baseName = path.basename(storedPath);
    const candidates = [
        path.resolve(__dirname, "../../", storedPath),
        path.resolve(process.cwd(), storedPath),
        path.resolve(process.cwd(), "backend", storedPath),
        path.resolve(__dirname, "../../uploads", baseName),
        path.resolve(process.cwd(), "uploads", baseName),
        path.resolve(process.cwd(), "backend/uploads", baseName),
        path.resolve(__dirname, "../../uploads/encrypted", baseName),
        path.resolve(process.cwd(), "uploads/encrypted", baseName),
        path.resolve(process.cwd(), "backend/uploads/encrypted", baseName)
    ];

    for (const p of candidates) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    return null;
};

const verifyEvidence = async (evidenceId, userId) => {
    const evidence = await evidenceModel.getEvidenceById(evidenceId);
    if (!evidence) {
        const err = new Error("Evidence record not found");
        err.status = 404;
        err.code = "EVIDENCE_NOT_FOUND";
        throw err;
    }

    const hasEncryptionMetadata = Boolean(
        evidence.encrypted_aes_key &&
        typeof evidence.encrypted_aes_key === "string" &&
        evidence.encrypted_aes_key.includes(":") &&
        evidence.encryption_iv &&
        evidence.encryption_auth_tag
    );

    const resolvedPath = resolveEvidenceFilePath(evidence.file_path);
    if (!resolvedPath) {
        if (userId) {
            try {
                await auditService.createAuditLog(
                    userId,
                    evidence.evidence_id,
                    "VERIFY_FAILED",
                    `Integrity check failed: physical file missing from storage for ${evidence.evidence_number}`
                );
            } catch (_) {}
        }
        return {
            evidence_id: evidence.evidence_id,
            evidence_number: evidence.evidence_number,
            stored_hash: evidence.file_hash,
            current_hash: null,
            integrity_status: "ERROR",
            message: "Source evidence file not found in storage."
        };
    }

    let fileToHash = resolvedPath;
    let temporaryDecryptedPath = null;

    if (hasEncryptionMetadata) {
        try {
            const aesKey = decryptAESKey(evidence.encrypted_aes_key);
            const tempDir = path.resolve(__dirname, "../../uploads/temp");
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            temporaryDecryptedPath = path.join(
                tempDir,
                `verify-${Date.now()}-${evidence.evidence_id}-${path.basename(evidence.file_name || "evidence")}`
            );

            decryptFile(
                resolvedPath,
                temporaryDecryptedPath,
                aesKey,
                evidence.encryption_iv,
                evidence.encryption_auth_tag
            );

            fileToHash = temporaryDecryptedPath;
        } catch (decErr) {
            if (temporaryDecryptedPath && fs.existsSync(temporaryDecryptedPath)) {
                try { fs.unlinkSync(temporaryDecryptedPath); } catch (_) {}
            }
            if (userId) {
                try {
                    await auditService.createAuditLog(
                        userId,
                        evidence.evidence_id,
                        "VERIFY_FAILED",
                        `Decryption failed during integrity check for ${evidence.evidence_number}: ${decErr.message}`
                    );
                } catch (_) {}
            }
            return {
                evidence_id: evidence.evidence_id,
                evidence_number: evidence.evidence_number,
                stored_hash: evidence.file_hash,
                current_hash: null,
                integrity_status: "ERROR",
                message: "Cryptographic decryption failed during integrity verification."
            };
        }
    }

    const fileBuffer = fs.readFileSync(fileToHash);
    const currentHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    const isValid = currentHash === evidence.file_hash;

    if (temporaryDecryptedPath && fs.existsSync(temporaryDecryptedPath)) {
        try { fs.unlinkSync(temporaryDecryptedPath); } catch (_) {}
    }

    if (userId) {
        try {
            await auditService.createAuditLog(
                userId,
                evidence.evidence_id,
                "VERIFIED",
                `Evidence integrity checked: ${isValid ? "VALID" : "TAMPERED"}`
            );
        } catch (_) {}
    }

    return {
        evidence_id: evidence.evidence_id,
        evidence_number: evidence.evidence_number,
        stored_hash: evidence.file_hash,
        current_hash: currentHash,
        integrity_status: isValid ? "VALID" : "TAMPERED"
    };
};

const getAllEvidence = async () => {
    const evidence = await evidenceModel.getAllEvidence();
    return {
        success: true,
        data: evidence
    };
};

const decryptEvidence = async (evidenceId, userId) => {
    if (!userId) {
        const err = new Error("Authenticated user required for decryption");
        err.status = 401;
        err.code = "AUTH_REQUIRED";
        throw err;
    }

    const evidence = await evidenceModel.getEvidenceById(evidenceId);
    if (!evidence) {
        const err = new Error("Evidence record not found");
        err.status = 404;
        err.code = "EVIDENCE_NOT_FOUND";
        throw err;
    }

    const hasEncryptionMetadata = Boolean(
        evidence.encrypted_aes_key &&
        typeof evidence.encrypted_aes_key === "string" &&
        evidence.encrypted_aes_key.includes(":") &&
        evidence.encryption_iv &&
        evidence.encryption_auth_tag
    );

    const resolvedPath = resolveEvidenceFilePath(evidence.file_path);

    // Case 1: Legacy unencrypted record (uploaded before envelope encryption existed)
    if (!hasEncryptionMetadata) {
        if (!resolvedPath) {
            try {
                await auditService.createAuditLog(
                    userId,
                    evidence.evidence_id,
                    "DECRYPTION_FAILED",
                    `Legacy unencrypted evidence file missing from storage: ${evidence.evidence_number}`
                );
            } catch (_) {}
            const err = new Error("This legacy record was uploaded prior to cryptographic envelope encryption and its physical file is not found in storage.");
            err.status = 404;
            err.code = "LEGACY_FILE_NOT_FOUND";
            throw err;
        }

        // Stream legacy unencrypted file directly
        const tempDir = path.resolve(__dirname, "../../uploads/temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const uniqueId = crypto.randomBytes(8).toString("hex");
        const safeBaseName = path.basename(evidence.file_name || `evidence-${evidence.evidence_number}`);
        const tempOutputFileName = `temp-legacy-${uniqueId}-${safeBaseName}`;
        const tempOutputPath = path.join(tempDir, tempOutputFileName);

        fs.copyFileSync(resolvedPath, tempOutputPath);

        try {
            await auditService.createAuditLog(
                userId,
                evidence.evidence_id,
                "ACCESSED",
                `Legacy unencrypted evidence file retrieved by authorized user: ${evidence.evidence_number}`
            );
        } catch (_) {}

        let downloadFileName = safeBaseName;
        const dashIndex = downloadFileName.indexOf("-");
        if (dashIndex > 0 && /^\d+$/.test(downloadFileName.substring(0, dashIndex))) {
            downloadFileName = downloadFileName.substring(dashIndex + 1);
        }

        return {
            tempFilePath: tempOutputPath,
            downloadFileName: `legacy-unencrypted-${downloadFileName}`,
            isLegacy: true,
            evidence_id: evidence.evidence_id,
            evidence_number: evidence.evidence_number
        };
    }

    // Case 2: Cryptographically sealed record
    if (!resolvedPath) {
        try {
            await auditService.createAuditLog(
                userId,
                evidence.evidence_id,
                "DECRYPTION_FAILED",
                `Encrypted source file missing from storage: ${evidence.evidence_number}`
            );
        } catch (_) {}
        const err = new Error("Encrypted source evidence file not found in storage.");
        err.status = 404;
        err.code = "ENCRYPTED_FILE_NOT_FOUND";
        throw err;
    }

    const tempDir = path.resolve(__dirname, "../../uploads/temp");
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const uniqueId = crypto.randomBytes(8).toString("hex");
    const safeBaseName = path.basename(evidence.file_name || `evidence-${evidence.evidence_number}`);
    const tempOutputFileName = `temp-decrypt-${uniqueId}-${safeBaseName}`;
    const tempOutputPath = path.join(tempDir, tempOutputFileName);

    let aesKey;
    try {
        aesKey = decryptAESKey(evidence.encrypted_aes_key);
    } catch (keyErr) {
        try {
            await auditService.createAuditLog(
                userId,
                evidence.evidence_id,
                "DECRYPTION_FAILED",
                `Failed to unwrap AES key for evidence: ${evidence.evidence_number}`
            );
        } catch (_) {}
        const err = new Error("Failed to unwrap evidence encryption key: " + keyErr.message);
        err.status = 422;
        err.code = "KEY_UNWRAP_FAILED";
        throw err;
    }

    try {
        decryptFile(
            resolvedPath,
            tempOutputPath,
            aesKey,
            evidence.encryption_iv,
            evidence.encryption_auth_tag
        );
    } catch (fileErr) {
        if (fs.existsSync(tempOutputPath)) {
            try { fs.unlinkSync(tempOutputPath); } catch (_) {}
        }
        try {
            await auditService.createAuditLog(
                userId,
                evidence.evidence_id,
                "DECRYPTION_FAILED",
                `Authentication check failed while decrypting evidence file: ${evidence.evidence_number}`
            );
        } catch (_) {}
        const err = new Error("Cryptographic authentication or decryption failed for evidence file.");
        err.status = 422;
        err.code = "DECRYPTION_FAILED";
        throw err;
    }

    try {
        await auditService.createAuditLog(
            userId,
            evidence.evidence_id,
            "DECRYPTED",
            `Evidence decrypted and securely streamed to authorized user: ${evidence.evidence_number}`
        );
    } catch (_) {}

    let downloadFileName = safeBaseName;
    const dashIndex = downloadFileName.indexOf("-");
    if (dashIndex > 0 && /^\d+$/.test(downloadFileName.substring(0, dashIndex))) {
        downloadFileName = downloadFileName.substring(dashIndex + 1);
    }

    return {
        tempFilePath: tempOutputPath,
        downloadFileName: downloadFileName,
        isLegacy: false,
        evidence_id: evidence.evidence_id,
        evidence_number: evidence.evidence_number
    };
};

module.exports = {
    createEvidence,
    verifyEvidence,
    decryptEvidence,
    getAllEvidence
};
