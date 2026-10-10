"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { StewardLogo, ErrorBanner } from "../_components";

function hasNumber(s: string) {
  return /[0-9]/.test(s);
}
function hasSymbol(s: string) {
  return /[^a-zA-Z0-9]/.test(s);
}

function RuleRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div
      className="auth-rule-row"
      style={{ color: ok ? "var(--st-text)" : "var(--st-neutral-600)" }}
    >
      <span
        className="auth-rule-dot"
        style={{ background: ok ? "var(--st-accent)" : "var(--st-neutral-300)" }}
      />
      {label}
    </div>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const emailParam = params.get("email") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const longEnough = password.length >= 10;
  const hasNumberOrSymbol = hasNumber(password) || hasSymbol(password);
  const passwordsMatch = password.length > 0 && confirm === password;
  const canSubmit = longEnough && hasNumberOrSymbol && passwordsMatch && !loading;

  if (!token) {
    return (
      <div className="auth-form-well">
        <h2 className="auth-page-heading">Invalid link</h2>
        <p className="auth-page-subhead">
          This password reset link is missing or malformed.
        </p>
        <Link
          href="/forgot-password"
          style={{ color: "var(--st-accent)", fontWeight: 800, textDecoration: "none", fontSize: "15px" }}
        >
          Request a new link
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      await api.auth.resetPassword({ token, new_password: password });
      router.push("/login?reset=1");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      if (msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("used")) {
        setError("This link has expired or has already been used.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-form-well">
      <h2 className="auth-page-heading">Choose a new password</h2>
      {emailParam && (
        <p className="auth-page-subhead">
          You are resetting the password for{" "}
          <strong style={{ fontWeight: 800 }}>{emailParam}</strong>.
        </p>
      )}
      {!emailParam && (
        <p className="auth-page-subhead">Choose a strong password for your account.</p>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        <div>
          <label htmlFor="password" className="auth-label">
            New password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input auth-input--tall"
          />
        </div>

        <div>
          <label htmlFor="confirm" className="auth-label">
            Confirm new password
          </label>
          <input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="auth-input auth-input--tall"
          />
        </div>

        <div className="auth-rule-list">
          <RuleRow ok={longEnough} label="At least 10 characters" />
          <RuleRow ok={hasNumberOrSymbol} label="One number or symbol" />
          <RuleRow ok={passwordsMatch} label="Passwords match" />
        </div>

        {error && (
          <div>
            <ErrorBanner message={error} />
            {error.toLowerCase().includes("expired") && (
              <div style={{ marginTop: "8px" }}>
                <Link
                  href="/forgot-password"
                  style={{ fontSize: "14px", color: "var(--st-accent)", fontWeight: 800, textDecoration: "none" }}
                >
                  Get a new link
                </Link>
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="auth-submit-btn auth-submit-btn--inline"
          style={{
            background: canSubmit ? "var(--st-accent)" : "var(--st-neutral-300)",
            color: canSubmit ? "#fff" : "var(--st-neutral-600)",
            cursor: canSubmit ? "pointer" : "not-allowed",
            transition: "background 0.15s",
          }}
        >
          {loading ? "Saving…" : "Save new password"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="auth-page">
      <div className="auth-topbar">
        <StewardLogo size={22} />
      </div>

      <div className="auth-centered-page">
        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
