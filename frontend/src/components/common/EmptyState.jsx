import React from "react";

export default function EmptyState({
  icon = "📁",
  title = "No evidence found for this case.",
  message = "Select another investigation case or upload new digital evidence."
}) {
  return (
    <div className="dem-empty-state">
      <div className="dem-empty-icon">{icon}</div>
      <h3 className="dem-empty-title">{title}</h3>
      {message && <p className="dem-empty-message">{message}</p>}
    </div>
  );
}
