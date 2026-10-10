"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string | number;
}

export function Modal({ title, onClose, children, footer, width = 480 }: ModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      {/* Overlay */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(32, 30, 29, 0.52)",
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "relative",
          background: "var(--st-bg)",
          width: "100%",
          maxWidth: width,
          maxHeight: "calc(100dvh - 48px)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--st-shadow-lg)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 24px",
            borderBottom: "2px solid var(--st-divider)",
            flex: "none",
          }}
        >
          <h2
            id="modal-title"
            style={{
              margin: 0,
              fontSize: "18px",
              fontWeight: 800,
              fontFamily: "'Archivo', system-ui, sans-serif",
              letterSpacing: "-0.015em",
            }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              color: "var(--st-neutral-600)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "44px",
              minHeight: "44px",
            }}
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="square"
              aria-hidden="true"
              style={{ width: 16, height: 16 }}
            >
              <path d="M2 2l12 12M14 2L2 14" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: "20px 24px",
            overflowY: "auto",
            flex: 1,
          }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              padding: "14px 24px",
              borderTop: "2px solid var(--st-divider)",
              display: "flex",
              gap: "10px",
              justifyContent: "flex-end",
              flex: "none",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
