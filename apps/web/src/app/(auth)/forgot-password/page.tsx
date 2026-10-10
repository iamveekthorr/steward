"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { StewardLogo, ErrorBanner } from "../_components";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.auth.forgotPassword(email);
      const token = (res as { data?: { reset_token?: string } }).data?.reset_token;
      if (token) {
        fetch("/api/email/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: email,
            name: email.split("@")[0],
            token,
            email,
          }),
        }).catch(() => {});
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend(e: React.MouseEvent) {
    e.preventDefault();
    setSent(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-topbar">
        <StewardLogo size={22} />
        <Link href="/login" className="auth-topbar__back">
          ← Back to sign in
        </Link>
      </div>

      <div className="auth-centered-page">
        <div className="auth-form-well">
          <h2 className="auth-page-heading">Reset your password</h2>
          <p className="auth-page-subhead">
            Enter the email on your account and we will send a reset link. The link expires in 30
            minutes and can only be used once.
          </p>

          <form onSubmit={handleSubmit} className="auth-form">
            <div>
              <label htmlFor="email" className="auth-label">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input auth-input--tall"
              />
            </div>

            {error && <ErrorBanner message={error} />}

            {!sent && (
              <button
                type="submit"
                disabled={loading}
                className="auth-submit-btn auth-submit-btn--inline"
                style={{
                  background: loading ? "var(--st-neutral-400)" : "var(--st-accent)",
                  color: "#fff",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            )}

            {sent && (
              <div className="auth-success-banner">
                <strong>Sent.</strong> Check <strong>{email}</strong>, including your spam
                folder. Nothing after five minutes?{" "}
                <a
                  href="#"
                  onClick={handleResend}
                  style={{ color: "var(--st-accent)", fontWeight: 800, textDecoration: "none" }}
                >
                  Send it again
                </a>
                .
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
