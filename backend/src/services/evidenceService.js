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

const verifyEvidence = async (evidenceId, userId) => {
    const evidence = await evidenceModel.getEvidenceById(evidenceId);
    if (!evidence) {
        throw new Error("Evidence not found");
    }

    let fileToHash = evidence.file_path;
    let temporaryDecryptedPath = null;

    if (!path.isAbsolute(fileToHash)) {
        fileToHash = path.resolve(__dirname, "../../", fileToHash);
    }
    if (!fs.existsSync(fileToHash)) {
        const fallback = path.resolve(__dirname, "../../uploads", path.basename(evidence.file_path));
        if (fs.existsSync(fallback)) fileToHash = fallback;
    }

    // If the evidence is encrypted, decrypt it temporarily
    if (evidence.encrypted_aes_key) {
        const aesKey = decryptAESKey(evidence.encrypted_aes_key);
        const tempDir = path.resolve(__dirname, "../../uploads/temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        temporaryDecryptedPath = path.join(
            tempDir,
            `verify-${Date.now()}-${evidence.evidence_id}-${path.basename(evidence.file_name)}`
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

    if (!fs.existsSync(fileToHash)) {
        throw new Error("Evidence file not found on disk");
    }

    const fileBuffer = fs.readFileSync(fileToHash);
    const currentHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    const isValid = currentHash === evidence.file_hash;

    // Immediately delete temporary decrypted verification file
    if (temporaryDecryptedPath && fs.existsSync(temporaryDecryptedPath)) {
        try { fs.unlinkSync(temporaryDecryptedPath); } catch (_) {}
    }

    await auditService.createAuditLog(
        userId,
        evidence.evidence_id,
        "VERIFIED",
        `Evidence integrity checked: ${isValid ? "VALID" : "TAMPERED"}`
    );

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
        throw new Error("Authenticated user required for decryption");
    }

    const evidence = await evidenceModel.getEvidenceById(evidenceId);
    if (!evidence) {
        throw new Error("Evidence not found");
    }

    if (!evidence.encrypted_aes_key) {
        throw new Error("Evidence is not encrypted");
    }

    const aesKey = decryptAESKey(evidence.encrypted_aes_key);

    let encPath = evidence.file_path;
    if (!path.isAbsolute(encPath)) {
        encPath = path.resolve(__dirname, "../../", encPath);
    }
    if (!fs.existsSync(encPath)) {
        const fallback = path.resolve(__dirname, "../../uploads", path.basename(evidence.file_path));
        if (fs.existsSync(fallback)) {
            encPath = fallback;
        } else {
            const fallbackEnc = path.resolve(__dirname, "../../uploads/encrypted", path.basename(evidence.file_path));
            if (fs.existsSync(fallbackEnc)) encPath = fallbackEnc;
        }
    }

    if (!fs.existsSync(encPath)) {
        throw new Error("Encrypted source evidence file not found in storage");
    }

    const tempDir = path.resolve(__dirname, "../../uploads/temp");
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const uniqueId = crypto.randomBytes(8).toString("hex");
    const safeBaseName = path.basename(evidence.file_name || `evidence-${evidence.evidence_number}`);
    const tempOutputFileName = `temp-decrypt-${uniqueId}-${safeBaseName}`;
    const tempOutputPath = path.join(tempDir, tempOutputFileName);

    decryptFile(
        encPath,
        tempOutputPath,
        aesKey,
        evidence.encryption_iv,
        evidence.encryption_auth_tag
    );

    await auditService.createAuditLog(
        userId,
        evidence.evidence_id,
        "DECRYPTED",
        `Evidence decrypted and securely streamed to authorized user: ${evidence.evidence_number}`
    );

    // Clean up file name for client download (strip multer timestamp prefix if present)
    let downloadFileName = safeBaseName;
    const dashIndex = downloadFileName.indexOf("-");
    if (dashIndex > 0 && /^\d+$/.test(downloadFileName.substring(0, dashIndex))) {
        downloadFileName = downloadFileName.substring(dashIndex + 1);
    }

    return {
        tempFilePath: tempOutputPath,
        downloadFileName: downloadFileName,
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
