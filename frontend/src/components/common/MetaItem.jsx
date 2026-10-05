import React from "react";

export default function MetaItem({
  label,
  value,
  isMono = false,
  truncate = false,
  className = ""
}) {
  const displayVal = value !== undefined && value !== null && value !== "" ? value : "N/A";
  return (
    <div className={`dem-meta-item ${className}`}>
      <span className="dem-meta-label">{label}</span>
      <span
        className={`dem-meta-value ${isMono ? "dem-mono" : ""} ${truncate ? "dem-truncate" : ""}`}
        title={truncate ? String(displayVal) : undefined}
      >
        {displayVal}
      </span>
    </div>
  );
}
