import React from "react";

export default function SidebarItem({
  icon,
  label,
  active = false,
  badge,
  badgeVariant = "default",
  onClick,
  className = ""
}) {
  return (
    <button
      type="button"
      className={`dem-sidebar-item ${active ? "active" : ""} ${className}`}
      onClick={onClick}
    >
      <span className="dem-sidebar-icon">{icon}</span>
      <span className="dem-sidebar-label">{label}</span>
      {badge !== undefined && (
        <span className={`dem-sidebar-badge dem-badge-${badgeVariant}`}>
          {badge}
        </span>
      )}
    </button>
  );
}
