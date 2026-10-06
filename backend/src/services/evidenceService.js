const evidenceModel = require("../models/evidenceModel");
const auditService = require("./auditService");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { getMimeTypeByFileName } = require("../utils/mimeHelper");

const {
    decryptAESKey,
    decryptFile
} = require("../utils/encryption");

/**
 * Strips the Multer timestamp prefix (digits followed by hyphen) from a filename,
 * preserving the original base name and extension.
 * e.g., "1788700368459-lawofcrimes.pdf" -> "lawofcrimes.pdf"
 */
const cleanEvidenceFileName = (rawFileName) => {
    if (!rawFileName) return "evidence-file";
    const base = path.basename(rawFileName);
    const cleaned = base.replace(/^\d+-/, "");
    return cleaned || base;
};

/**
 * Robustly resolves the storage path of an evidence file on disk across
 * possible working directories.
 */
const resolveEvidenceFilePath = (rawPath) => {
    if (!rawPath) return null;
    if (fs.existsSync(rawPath)) return rawPath;

    const base = path.basename(rawPath);

    const candidates = [
        path.resolve(__dirname, "../../", rawPath),
        path.resolve(__dirname, "../../uploads", base),
        path.resolve(__dirname, "../../uploads/encrypted", base),
        path.resolve(process.cwd(), rawPath),
        path.resolve(process.cwd(), "backend", rawPath),
        path.resolve(process.cwd(), "uploads", base),
        path.resolve(process.cwd(), "backend/uploads", base),
        path.resolve(process.cwd(), "backend/uploads/encrypted", base)
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return null;
};

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

const verifyEvidence = async (evidenceId, userId) => {
    const evidence = await evidenceModel.getEvidenceById(evidenceId);
    if (!evidence) {
        const err = new Error("Evidence record not found");
        err.status = 404;
        throw err;
    }

    const hasEncryptionMetadata = Boolean(
        evidence.encrypted_aes_key &&
        typeof evidence.encrypted_aes_key === "string" &&
        evidence.encrypted_aes_key.includes(":") &&
        evidence.encryption_iv &&
        evidence.encryption_auth_tag
    );

    let fileToHash = resolveEvidenceFilePath(evidence.file_path);
    let temporaryDecryptedPath = null;

    if (hasEncryptionMetadata) {
        if (!fileToHash) {
            throw new Error("Encrypted evidence file not found on disk");
        }

        const aesKey = decryptAESKey(evidence.encrypted_aes_key);
        const tempDir = path.resolve(__dirname, "../../uploads/temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const safeBaseName = cleanEvidenceFileName(evidence.file_name || `evidence-${evidence.evidence_number}`);
        temporaryDecryptedPath = path.join(
            tempDir,
            `verify-${Date.now()}-${evidence.evidence_id}-${safeBaseName}`
        );

        decryptFile(
            fileToHash,
            temporaryDecryptedPath,
            aesKey,
            evidence.encryption_iv,
            evidence.encryption_auth_tag
        );

        fileToHash = temporaryDecryptedPath;
    }

    if (!fileToHash || !fs.existsSync(fileToHash)) {
        throw new Error("Evidence file not found on disk");
    }

    const fileBuffer = fs.readFileSync(fileToHash);
    const currentHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    const isValid = currentHash === evidence.file_hash;

    // Immediately clean up temporary decrypted verification file
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

    if (!hasEncryptionMetadata) {
        const err = new Error("No encrypted data for this record");
        err.status = 400;
        err.code = "NOT_ENCRYPTED";
        throw err;
    }

    const resolvedPath = resolveEvidenceFilePath(evidence.file_path);
    if (!resolvedPath) {
        try {
            await auditService.createAuditLog(
                userId,
                evidence.evidence_id,
                "DECRYPTION_FAILED",
                `Encrypted source file missing from storage for ${evidence.evidence_number}`
            );
        } catch (_) {}
        const err = new Error("Encrypted source evidence file not found in storage.");
        err.status = 404;
        err.code = "FILE_NOT_FOUND";
        throw err;
    }

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

    const tempDir = path.resolve(__dirname, "../../uploads/temp");
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const uniqueId = crypto.randomBytes(8).toString("hex");
    const downloadFileName = cleanEvidenceFileName(evidence.file_name || `evidence-${evidence.evidence_number}`);
    const tempOutputFileName = `temp-decrypt-${uniqueId}-${downloadFileName}`;
    const tempOutputPath = path.join(tempDir, tempOutputFileName);

    let decryptedBuffer;
    try {
        decryptedBuffer = decryptFile(
            resolvedPath,
            tempOutputPath,
            aesKey,
            evidence.encryption_iv,
            evidence.encryption_auth_tag
        );
    } catch (gcmErr) {
        // GCM authentication check failed -> Data tampering detected!
        if (fs.existsSync(tempOutputPath)) {
            try { fs.unlinkSync(tempOutputPath); } catch (_) {}
        }
        try {
            await auditService.createAuditLog(
                userId,
                evidence.evidence_id,
                "DECRYPTION_FAILED",
                `Tamper detected: GCM authentication check failed for ${evidence.evidence_number}`
            );
        } catch (_) {}
        const err = new Error("Evidence integrity verification failed: GCM authentication check failed. Data has been tampered with.");
        err.status = 422;
        err.code = "TAMPER_DETECTED";
        throw err;
    }

    // Forensic SHA-256 integrity check on the decrypted bytes before serving
    const fileBuffer = decryptedBuffer || fs.readFileSync(tempOutputPath);
    const computedHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    if (computedHash !== evidence.file_hash) {
        if (fs.existsSync(tempOutputPath)) {
            try { fs.unlinkSync(tempOutputPath); } catch (_) {}
        }
        try {
            await auditService.createAuditLog(
                userId,
                evidence.evidence_id,
                "DECRYPTION_FAILED",
                `Tamper detected: SHA-256 hash mismatch for ${evidence.evidence_number}`
            );
        } catch (_) {}
        const err = new Error("Evidence integrity verification failed: Decrypted SHA-256 hash does not match stored forensic record.");
        err.status = 422;
        err.code = "TAMPER_DETECTED";
        throw err;
    }

    // Log successful decryption to audit trail
    try {
        await auditService.createAuditLog(
            userId,
            evidence.evidence_id,
            "DECRYPTED",
            `Evidence decrypted and integrity verified: ${evidence.evidence_number}`
        );
    } catch (_) {}

    const mimeType = getMimeTypeByFileName(downloadFileName);

    return {
        tempFilePath: tempOutputPath,
        downloadFileName: downloadFileName,
        mimeType: mimeType,
        evidence_id: evidence.evidence_id,
        evidence_number: evidence.evidence_number
    };
};

const downloadLegacyEvidence = async (evidenceId, userId) => {
    if (!userId) {
        const err = new Error("Authenticated user required for legacy download");
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

    if (evidence.is_legacy_seed) {
        const err = new Error("Legacy seed record has no physical file on disk");
        err.status = 404;
        err.code = "LEGACY_SEED_NO_FILE";
        throw err;
    }

    const hasEncryptionMetadata = Boolean(
        evidence.encrypted_aes_key &&
        typeof evidence.encrypted_aes_key === "string" &&
        evidence.encrypted_aes_key.includes(":") &&
        evidence.encryption_iv &&
        evidence.encryption_auth_tag
    );

    if (hasEncryptionMetadata) {
        const err = new Error("This record is encrypted with envelope encryption. Use the decrypt endpoint instead.");
        err.status = 400;
        err.code = "ENCRYPTED_RECORD";
        throw err;
    }

    const resolvedPath = resolveEvidenceFilePath(evidence.file_path);
    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
        try {
            await auditService.createAuditLog(
                userId,
                evidence.evidence_id,
                "LEGACY_DOWNLOAD_FAILED",
                `Legacy source file missing from storage for ${evidence.evidence_number}`
            );
        } catch (_) {}
        const err = new Error("Legacy source evidence file not found in storage.");
        err.status = 404;
        err.code = "FILE_NOT_FOUND";
        throw err;
    }

    // Recompute SHA-256 and refuse with 422 plus an audit entry if it does not match file_hash
    const fileBuffer = fs.readFileSync(resolvedPath);
    const computedHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    if (computedHash !== evidence.file_hash) {
        try {
            await auditService.createAuditLog(
                userId,
                evidence.evidence_id,
                "LEGACY_DOWNLOAD_FAILED",
                `Tamper detected on legacy evidence: SHA-256 mismatch for ${evidence.evidence_number}`
            );
        } catch (_) {}
        const err = new Error("Legacy evidence integrity verification failed: Stored hash does not match file on disk.");
        err.status = 422;
        err.code = "TAMPER_DETECTED";
        throw err;
    }

    // Write LEGACY_FILE_DOWNLOAD to audit_logs
    try {
        await auditService.createAuditLog(
            userId,
            evidence.evidence_id,
            "LEGACY_FILE_DOWNLOAD",
            `Legacy unencrypted evidence downloaded and verified: ${evidence.evidence_number}`
        );
    } catch (_) {}

    const downloadFileName = cleanEvidenceFileName(evidence.file_name || `evidence-${evidence.evidence_number}`);
    const mimeType = getMimeTypeByFileName(downloadFileName);

    return {
        filePath: resolvedPath,
        downloadFileName,
        mimeType,
        evidence_id: evidence.evidence_id,
        evidence_number: evidence.evidence_number,
        fileHash: computedHash
    };
};

module.exports = {
    createEvidence,
    verifyEvidence,
    decryptEvidence,
    downloadLegacyEvidence,
    getAllEvidence
};
