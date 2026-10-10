"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { API_BASE } from "@/lib/api";

type Status = "verifying" | "success" | "error";

function VerifyEmailContent() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<Status>("verifying");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token found. Please use the link from your email.");
      return;
    }

    fetch(`${API_BASE}/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((body: { status?: boolean; message?: string }) => {
        if (body.status) {
          setStatus("success");
        } else {
          setStatus("error");
          setMessage(body.message ?? "Verification failed. Please try again.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      });
  }, [token]);

  return (
    <div className="ve-page">
      <div className="ve-topbar">
        <div className="auth-logo" style={{ fontSize: 20 }}>
          <svg
            viewBox="0 2 16 19.4"
            className="auth-logo__icon"
            style={{ color: "var(--st-accent)" }}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.9"
            strokeLinecap="square"
            aria-hidden="true"
          >
            <path d="M14 3.5H6.2a4.1 4.1 0 0 0 0 8.2h3.6a4.1 4.1 0 0 1 0 8.2H2" />
            <path d="M11.5 1L14 3.5L11.5 6M4.5 17.4L2 19.9L4.5 22.4" />
          </svg>
          <span>teward</span>
        </div>
      </div>

      <div className="ve-body">
        <div className="ve-well">
          {status === "verifying" && (
            <>
              <div className="ve-spinner" />
              <h1 className="ve-heading">Verifying your email…</h1>
              <p className="ve-body-text ve-body-text--compact">
                Please wait while we confirm your address.
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="ve-success-icon">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <h1 className="ve-heading">Email verified</h1>
              <p className="ve-body-text">
                Your email address has been confirmed. You can now sign in to your account.
              </p>
              <Link href="/login" className="ve-btn-primary">
                Sign in
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <div className="ve-error-icon">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--st-neutral-600)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </div>
              <h1 className="ve-heading">Link expired</h1>
              <p className="ve-body-text">{message}</p>
              <Link href="/login" className="ve-link">
                Back to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
