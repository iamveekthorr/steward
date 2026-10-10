import type { ReactNode } from "react";

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  helper?: string;
  children: ReactNode;
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--st-neutral-600)",
  marginBottom: "6px",
  fontFamily: "'Archivo', system-ui, sans-serif",
};

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid var(--st-divider)",
  background: "var(--st-bg)",
  fontSize: "14px",
  outline: "none",
  fontFamily: "'Archivo', system-ui, sans-serif",
  minHeight: "44px",
  boxSizing: "border-box",
};

export function FormField({ id, label, required, error, helper, children }: FormFieldProps) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <label
        htmlFor={id}
        data-required={required ? "true" : undefined}
        aria-required={required}
        style={labelStyle}
      >
        {label}
      </label>
      {children}
      {helper && !error && (
        <p
          style={{
            margin: "4px 0 0",
            fontSize: "12px",
            color: "var(--st-neutral-600)",
            lineHeight: 1.5,
          }}
        >
          {helper}
        </p>
      )}
      {error && (
        <p
          role="alert"
          style={{
            margin: "4px 0 0",
            fontSize: "12px",
            color: "var(--st-alert)",
            lineHeight: 1.5,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
