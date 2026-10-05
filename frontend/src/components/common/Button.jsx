import React from "react";

export default function Button({
  children,
  variant = "primary", // "primary", "secondary", "outline", "danger"
  size = "md", // "sm", "md", "lg"
  icon,
  loading = false,
  disabled = false,
  onClick,
  type = "button",
  className = "",
  style = {}
}) {
  return (
    <button
      type={type}
      className={`dem-btn dem-btn-${variant} dem-btn-${size} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
      style={style}
    >
      {loading ? (
        <span className="dem-btn-spinner" />
      ) : (
        icon && <span className="dem-btn-icon">{icon}</span>
      )}
      <span className="dem-btn-text">{children}</span>
    </button>
  );
}
