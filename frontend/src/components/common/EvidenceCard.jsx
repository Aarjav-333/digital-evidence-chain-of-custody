import React from "react";
import Card from "./Card";
import Badge from "./Badge";
import Button from "./Button";
import MetaItem from "./MetaItem";
import { canDecryptEvidence } from "../../utils/permissionHelper";

export default function EvidenceCard({
  item,
  verification,
  isVerifying = false,
  isDecrypting = false,
  onVerify,
  onDecrypt,
  onLegacyDownload,
  user
}) {
  const getTypeVariant = (type) => {
    const t = (type || "").toLowerCase();
    if (t.includes("doc") || t.includes("pdf") || t.includes("txt")) return "doc";
    if (t.includes("audio") || t.includes("mp3") || t.includes("wav")) return "audio";
    if (t.includes("video") || t.includes("mp4") || t.includes("mkv")) return "video";
    if (t.includes("image") || t.includes("jpg") || t.includes("png")) return "image";
    return "default";
  };

  const userCanDecrypt = canDecryptEvidence(user);
  const isLegacySeed = Boolean(item.is_legacy_seed || (item.evidence_id <= 3 && item.encrypted_aes_key === "temporary_key"));
  const isEncrypted = item.is_encrypted !== undefined
    ? Boolean(item.is_encrypted)
    : Boolean(item.encrypted_aes_key && typeof item.encrypted_aes_key === "string" && item.encrypted_aes_key.includes(":"));
  const isLegacyUnencrypted = !isEncrypted && !isLegacySeed;

  return (
    <Card className="dem-evidence-card">
      {/* (a) Header Row: Evidence ID badge on left, type badge on right */}
      <div className="dem-evidence-top-row">
        <span className="dem-evidence-id-badge">{item.evidence_number}</span>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {isEncrypted ? (
            <Badge variant="purple" size="sm" title="Cryptographically sealed with AES-256-GCM">
              Encrypted
            </Badge>
          ) : (
            <Badge variant="warning" size="sm" title="Uploaded prior to cryptographic envelope encryption">
              Legacy
            </Badge>
          )}
          <Badge variant={getTypeVariant(item.evidence_type)}>
            {item.evidence_type || "Document"}
          </Badge>
        </div>
      </div>

      {/* (b) Title: 18px / 600, clamped to 2 lines */}
      <h3 className="dem-evidence-title" title={item.evidence_name}>
        {item.evidence_name}
      </h3>

      {/* (c) Divider */}
      <div className="dem-card-divider" />

      {/* (d) Metadata Block: Single-column stack, 16px between items */}
      <div className="dem-metadata-stack">
        <MetaItem
          label="FILE"
          value={item.file_name}
          isFile
        />
        <MetaItem
          label="UPLOADED BY"
          value={item.uploader_name || `User ${item.uploaded_by}`}
        />
        <MetaItem
          label="UPLOADED AT"
          value={item.uploaded_at ? new Date(item.uploaded_at).toLocaleString() : "N/A"}
        />
        <MetaItem
          label="DESCRIPTION"
          value={item.description || "No description provided."}
          isDescription
        />
      </div>

      {/* Cryptographic Verification Box (if verified) */}
      {verification && (
        <div
          className={`dem-verify-box dem-verify-${
            verification.integrity_status === "VALID"
              ? "valid"
              : verification.integrity_status === "TAMPERED"
              ? "tampered"
              : "error"
          }`}
        >
          <div className="dem-verify-header">
            <span className="dem-verify-tag">
              {verification.integrity_status === "VALID"
                ? "✓ VALID"
                : verification.integrity_status === "TAMPERED"
                ? "⚠ TAMPERED"
                : "✕ ERROR"}
            </span>
            <span className="dem-verify-msg">
              {verification.integrity_status === "VALID" &&
                "Integrity verified. Cryptographic hash matches chain of custody."}
              {verification.integrity_status === "TAMPERED" &&
                "Tamper alert: File hash does not match original registered hash."}
              {verification.integrity_status === "ERROR" &&
                (verification.message || "An error occurred during integrity verification.")}
            </span>
          </div>

          {(verification.stored_hash || verification.current_hash) && (
            <div className="dem-verify-hashes">
              {verification.stored_hash && (
                <div className="dem-hash-row">
                  <span className="dem-hash-label">Registered Hash:</span>
                  <code className="dem-hash-code">{verification.stored_hash}</code>
                </div>
              )}
              {verification.current_hash && (
                <div className="dem-hash-row">
                  <span className="dem-hash-label">Computed Hash:</span>
                  <code className="dem-hash-code">{verification.current_hash}</code>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* (e) Divider */}
      <div className="dem-card-divider" />

      {/* (f) Footer with Actions */}
      <div className="dem-evidence-footer">
        <Button
          variant="outline"
          icon="🛡️"
          loading={isVerifying}
          disabled={isVerifying || isDecrypting}
          onClick={() => onVerify(item.evidence_id)}
        >
          {isVerifying ? "Verifying..." : "Verify Integrity"}
        </Button>

        {!userCanDecrypt ? (
          <Button
            variant="primary"
            icon="🔒"
            disabled={true}
            title="Decryption restricted to System Administrator and Forensic Analyst"
          >
            Decrypt Evidence
          </Button>
        ) : isLegacySeed ? (
          <Button
            variant="primary"
            icon="🔒"
            disabled={true}
            title="No encrypted data for this record"
          >
            Decrypt Evidence
          </Button>
        ) : isLegacyUnencrypted ? (
          <Button
            variant="primary"
            icon="📥"
            loading={isDecrypting}
            disabled={isDecrypting || isVerifying}
            onClick={() => onLegacyDownload ? onLegacyDownload(item.evidence_id) : onDecrypt(item.evidence_id)}
            title="Download and verify unencrypted legacy evidence"
          >
            {isDecrypting ? "Downloading..." : "Download (Legacy)"}
          </Button>
        ) : (
          <Button
            variant="primary"
            icon="🔒"
            loading={isDecrypting}
            disabled={isDecrypting || isVerifying}
            onClick={() => onDecrypt(item.evidence_id)}
            title="Decrypt AES-256-GCM encrypted evidence"
          >
            {isDecrypting ? "Processing..." : "Decrypt Evidence"}
          </Button>
        )}
      </div>
    </Card>
  );
}
