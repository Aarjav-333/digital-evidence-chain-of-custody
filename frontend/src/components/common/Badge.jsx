import React from "react";

export default function Badge({
  children,
  variant = "default", // "default", "doc", "audio", "video", "image", "valid", "tampered", "accent", "count"
  size = "md",
  className = ""
}) {
  return (
    <span className={`dem-badge dem-badge-${variant} dem-badge-${size} ${className}`}>
      {children}
    </span>
  );
}
