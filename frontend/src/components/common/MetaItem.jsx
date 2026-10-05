import React from "react";

export default function MetaItem({
  label,
  value,
  isMono = false,
  isFile = false,
  isDescription = false,
  truncate = false,
  className = ""
}) {
  const displayVal = value !== undefined && value !== null && value !== "" ? value : "N/A";

  let valClass = "dem-meta-value";
  if (isFile || isMono) valClass += " dem-meta-file";
  if (isDescription) valClass += " dem-meta-desc";
  if (truncate) valClass += " dem-truncate";

  return (
    <div className={`dem-meta-item ${className}`}>
      <span className="dem-meta-label">{label}</span>
      <span
        className={valClass}
        title={typeof displayVal === "string" ? displayVal : undefined}
      >
        {displayVal}
      </span>
    </div>
  );
}
