import React from "react";
import Card from "./Card";
import Badge from "./Badge";
import Button from "./Button";
import MetaItem from "./MetaItem";

export default function EvidenceCard({
  item,
  verification,
  isVerifying,
  onVerify,
  onDecrypt
}) {
  const getTypeVariant = (type) => {
    const t = (type || "").toLowerCase();
    if (t.includes("doc") || t.includes("pdf") || t.includes("txt")) return "doc";
    if (t.includes("audio") || t.includes("mp3") || t.includes("wav")) return "audio";
    if (t.includes("video") || t.includes("mp4") || t.includes("mkv")) return "video";
    if (t.includes("image") || t.includes("jpg") || t.includes("png")) return "image";
    return "default";
  };

  return (
    <Card className="dem-evidence-card">
      {/* (a) Header Row: Evidence ID badge on left, type badge on right */}
      <div className="dem-evidence-top-row">
        <span className="dem-evidence-id-badge">{item.evidence_number}</span>
        <Badge variant={getTypeVariant(item.evidence_type)}>
          {item.evidence_type || "Document"}
        </Badge>
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
          onClick={() => onVerify(item.evidence_id)}
        >
          {isVerifying ? "Verifying..." : "Verify Integrity"}
        </Button>

        <Button
          variant="primary"
          icon="🔒"
          onClick={() => onDecrypt(item.evidence_id)}
        >
          Decrypt Evidence
        </Button>
      </div>
    </Card>
  );
}
