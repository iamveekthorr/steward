"use client";

import { useEffect } from "react";

export type ToastState = {
  message: string;
  type: "success" | "error" | "info";
};

interface ToastProps {
  state: ToastState;
  onDismiss: () => void;
}

const TYPE_STYLE = {
  success: { bg: "var(--st-accent-800)", color: "#fff" },
  error: { bg: "var(--st-alert)", color: "#fff" },
  info: { bg: "var(--st-neutral-900)", color: "#fff" },
};

export function Toast({ state, onDismiss }: ToastProps) {
  const s = TYPE_STYLE[state.type];

  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        gap: "12px",
        background: s.bg,
        color: s.color,
        padding: "12px 18px",
        fontSize: "13px",
        fontWeight: 800,
        fontFamily: "'Archivo', system-ui, sans-serif",
        boxShadow: "var(--st-shadow-lg)",
        maxWidth: "340px",
        animation: "ds-toast-in 0.18s ease-out",
      }}
    >
      <span style={{ flex: 1 }}>{state.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "inherit",
          opacity: 0.7,
          padding: "2px",
          display: "flex",
          minWidth: "28px",
          minHeight: "28px",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="square"
          aria-hidden="true"
          style={{ width: 12, height: 12 }}
        >
          <path d="M1 1l10 10M11 1L1 11" />
        </svg>
      </button>
    </div>
  );
}
