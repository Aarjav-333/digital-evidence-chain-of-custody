import React from "react";

export default function PageHeader({ title, subtitle, user }) {
  const getRoleTitle = (u) => {
    if (u?.role_name) return u.role_name;
    switch (u?.role_id) {
      case 1:
        return "System Administrator";
      case 2:
        return "Police Officer";
      case 3:
        return "Case Manager";
      case 4:
        return "Forensic Analyst";
      default:
        return "Case Manager";
    }
  };

  const name = user?.full_name || "Robert Miller";
  const role = getRoleTitle(user);
  const employeeId = user?.employee_id || "POL2026-CM03";

  return (
    <div className="dem-page-header">
      <div className="dem-header-titles">
        <h1 className="dem-page-title">{title}</h1>
        {subtitle && <p className="dem-page-subtitle">{subtitle}</p>}
      </div>

      <div className="dem-user-chip">
        <div className="dem-user-avatar">
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="dem-user-details">
          <span className="dem-user-name">
            {name} <span className="dem-user-role">• {role}</span>
          </span>
          <span className="dem-user-id">{employeeId}</span>
        </div>
      </div>
    </div>
  );
}
