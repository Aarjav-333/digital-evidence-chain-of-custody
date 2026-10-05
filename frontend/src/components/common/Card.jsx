import React from "react";

export default function Card({
  children,
  className = "",
  header,
  footer,
  style = {},
  onClick
}) {
  return (
    <div
      className={`dem-card ${className}`}
      style={style}
      onClick={onClick}
    >
      {header && <div className="dem-card-header">{header}</div>}
      <div className="dem-card-body">{children}</div>
      {footer && <div className="dem-card-footer">{footer}</div>}
    </div>
  );
}
