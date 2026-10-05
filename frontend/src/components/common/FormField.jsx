import React from "react";

export default function FormField({
  label,
  id,
  required = false,
  error,
  hint,
  children,
  className = ""
}) {
  return (
    <div className={`dem-form-field ${className}`}>
      {label && (
        <label className="dem-form-label" htmlFor={id}>
          {label}
          {required && <span className="dem-required">*</span>}
        </label>
      )}
      <div className="dem-form-control">{children}</div>
      {error && <span className="dem-form-error">{error}</span>}
      {hint && !error && <span className="dem-form-hint">{hint}</span>}
    </div>
  );
}
