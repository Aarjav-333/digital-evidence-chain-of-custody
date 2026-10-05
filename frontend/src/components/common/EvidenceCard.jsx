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
      {/* Top Row: Evidence ID on left and type badge on right */}
      <div className="dem-evidence-top-row">
        <span className="dem-evidence-id-badge">{item.evidence_number}</span>
        <Badge variant={getTypeVariant(item.evidence_type)}>
          {item.evidence_type || "Document"}
        </Badge>
      </div>

      {/* Title as 18px bold heading */}
      <h3 className="dem-evidence-title">{item.evidence_name}</h3>
      <div className="dem-card-divider" />

      {/* Metadata 2-column grid of label/value pairs */}
      <div className="dem-metadata-grid">
        <MetaItem
          label="FILE"
          value={item.file_name}
          isMono
          truncate
        />
        <MetaItem
          label="UPLOADED BY"
          value={`User ${item.uploaded_by}`}
        />
        <MetaItem
          label="UPLOADED AT"
          value={item.uploaded_at ? new Date(item.uploaded_at).toLocaleString() : "N/A"}
        />
        <MetaItem
          label="DESCRIPTION"
          value={item.description || "No description provided."}
          className="dem-meta-desc-span"
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

      {/* Footer Row with 16px gap above */}
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
