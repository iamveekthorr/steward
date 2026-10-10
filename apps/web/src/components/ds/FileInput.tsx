"use client";

import { useRef, type ChangeEvent } from "react";

export interface FileInputProps {
  id?: string;
  accept?: string;
  value: File | null;
  onChange: (file: File | null) => void;
  hint?: string;
  disabled?: boolean;
}

export function FileInput({ id, accept, value, onChange, hint = "Choose a file", disabled }: FileInputProps) {
  const ref = useRef<HTMLInputElement>(null);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    onChange(e.target.files?.[0] ?? null);
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
    if (ref.current) ref.current.value = "";
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && ref.current?.click()}
      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !disabled) ref.current?.click(); }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        border: value
          ? "1px solid var(--st-accent)"
          : "1px dashed color-mix(in srgb, var(--st-text) 40%, transparent)",
        background: value
          ? "color-mix(in srgb, var(--st-accent) 5%, transparent)"
          : "var(--st-surface)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        userSelect: "none",
        minHeight: 52,
        outline: "none",
        transition: "border-color 150ms ease, background 150ms ease",
      }}
      onFocus={(e) => (e.currentTarget.style.outline = "2px solid var(--st-accent)")}
      onBlur={(e) => (e.currentTarget.style.outline = "none")}
    >
      {/* Icon */}
      <div style={{
        width: 36,
        height: 36,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        color: value ? "var(--st-accent)" : "var(--st-neutral-600)",
      }}>
        {value ? (
          // File icon when selected
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        ) : (
          // Upload icon
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          fontWeight: value ? 600 : 400,
          color: value ? "var(--st-text)" : "var(--st-neutral-700)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontFamily: "var(--st-font)",
        }}>
          {value ? value.name : "Upload file"}
        </div>
        <div style={{ fontSize: 11, color: "var(--st-neutral-600)", marginTop: 1, fontFamily: "var(--st-font)" }}>
          {value
            ? `${(value.size / (1024 * 1024)).toFixed(1)} MB`
            : hint}
        </div>
      </div>

      {/* Remove button */}
      {value && !disabled && (
        <button
          type="button"
          onClick={clear}
          aria-label="Remove file"
          style={{
            width: 28,
            height: 28,
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--st-neutral-600)",
            padding: 0,
          }}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}

      {/* Hidden native input */}
      <input
        ref={ref}
        id={id}
        type="file"
        accept={accept}
        onChange={handleChange}
        disabled={disabled}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
        tabIndex={-1}
        aria-hidden
      />
    </div>
  );
}
