"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "@/lib/api";

type StepState = "done" | "active" | "pending";

interface Step {
  label: string;
  when: string;
  state: StepState;
}

function VerificationContent() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const role = params.get("role") ?? "manager";
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleResend() {
    if (!email || resendState === "sending" || resendState === "sent") return;
    setResendState("sending");
    try {
      const res = await api.auth.resendVerification(email);
      const token = (res as { data?: { verification_token?: string } }).data?.verification_token;
      if (token) {
        fetch("/api/email/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: email, name: email.split("@")[0], token }),
        }).catch(() => {});
      }
      setResendState("sent");
    } catch {
      setResendState("error");
    }
  }

  const isManager = role === "manager";

  const steps: Step[] = [
    { label: "Account created", when: "Done", state: "done" },
    { label: "Email verified", when: "Check your inbox", state: "active" },
    ...(isManager
      ? [
          { label: "Under review", when: "1–2 business days", state: "pending" as StepState },
          { label: "Links and payments unlocked", when: "—", state: "pending" as StepState },
        ]
      : []),
  ];

  return (
    <div className="vp-page">
      <div className="vp-topbar">
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
        <div className="vp-topbar__actions">
          <span className="vp-status-badge">
            {isManager ? "Pending review" : "Email pending"}
          </span>
          <Link href="/login" className="vp-sign-in">
            Sign in
          </Link>
        </div>
      </div>

      <div className="vp-grid">
        {/* Left: copy */}
        <div className="vp-left">
          <h1 className="vp-heading">
            {isManager ? "Your account is under review" : "Check your email"}
          </h1>

          <p className="vp-body-text">
            {isManager ? (
              <>
                We check every manager account before it can add links or move money. We also
                sent a verification email to{" "}
                {email ? <strong>{email}</strong> : "your inbox"} — click the link to confirm
                your address. You will hear from us within one working day.
              </>
            ) : (
              <>
                We sent a verification link to{" "}
                {email ? <strong>{email}</strong> : "your email address"}. Click it to activate
                your account, then sign in.
              </>
            )}
          </p>

          <div className="vp-actions">
            <div className="vp-action-row">
              <Link href="/login" className="vp-btn-outline">
                Back to sign in
              </Link>
              {email && (
                <button
                  onClick={handleResend}
                  disabled={resendState === "sending" || resendState === "sent"}
                  style={{
                    display: "inline-block",
                    padding: "12px 22px",
                    background:
                      resendState === "sent" ? "var(--st-accent-100)" : "var(--st-accent)",
                    color: resendState === "sent" ? "var(--st-accent-700)" : "#fff",
                    border: 0,
                    fontSize: 13,
                    fontWeight: 800,
                    cursor:
                      resendState === "sending" || resendState === "sent"
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {resendState === "sending"
                    ? "Sending…"
                    : resendState === "sent"
                    ? "Email sent"
                    : "Resend email"}
                </button>
              )}
            </div>
            {resendState === "error" && (
              <p className="vp-error-msg">Failed to resend. Please try again.</p>
            )}
          </div>
        </div>

        {/* Right: status steps */}
        <div className="vp-right">
          <div className="vp-steps-kicker">Where you are</div>

          <div className="vp-steps-list">
            {steps.map((step) => (
              <div key={step.label} className="vp-step">
                <span className={`vp-step-dot vp-step-dot--${step.state}`} />
                <span
                  className={`vp-step__label${step.state === "pending" ? " vp-step__label--pending" : ""}`}
                >
                  {step.label}
                </span>
                <span
                  className={`vp-step__when${step.state === "active" ? " vp-step__when--active" : ""}`}
                >
                  {step.when}
                </span>
              </div>
            ))}
          </div>

          {isManager && (
            <p className="vp-manager-note">
              Verified managers can add links, configure payment schedules and record payouts.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerificationPendingPage() {
  return (
    <Suspense>
      <VerificationContent />
    </Suspense>
  );
}
