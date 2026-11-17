"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { setAuthCookie, useAuth } from "@/lib/auth";
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

export default function ForceChangePasswordPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Guard: if no must_change_password flag, the user got here by accident.
  useEffect(() => {
    const flag =
      localStorage.getItem("must_change_password") ??
      sessionStorage.getItem("must_change_password");
    if (!flag) {
      router.replace("/login");
    }
  }, [router]);

  const longEnough = newPassword.length >= 10;
  const hasNumberOrSymbol = hasNumber(newPassword) || hasSymbol(newPassword);
  const passwordsMatch = newPassword.length > 0 && confirm === newPassword;
  const differentFromCurrent = newPassword.length > 0 && newPassword !== currentPassword;
  const canSubmit =
    currentPassword.length > 0 &&
    longEnough &&
    hasNumberOrSymbol &&
    passwordsMatch &&
    differentFromCurrent &&
    !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);

    try {
      await api.auth.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });

      // Clear the forced-change flag from wherever it was stored.
      localStorage.removeItem("must_change_password");
      sessionStorage.removeItem("must_change_password");

      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleContinue() {
    // Refresh auth context so the layout sees the authenticated user, then
    // route to the appropriate dashboard.
    await refreshUser();

    const token =
      localStorage.getItem("access_token") ??
      sessionStorage.getItem("access_token") ??
      "";

    // Decode role from JWT to pick the right home route.
    let role = "manager";
    try {
      const payload = token.split(".")[1];
      const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
      role = decoded.role ?? "manager";
      // Renew the cookie so middleware sees the token as valid.
      setAuthCookie(token);
    } catch {
      // fall through — default to /manager
    }

    router.push(role === "link" ? "/worker" : "/manager");
  }

  if (done) {
    return (
      <div className="auth-page">
        <div className="auth-topbar">
          <StewardLogo size={22} />
        </div>

        <div className="auth-centered-page">
          <div className="auth-form-well">
            <div
              className="auth-rule-dot"
              style={{
                background: "var(--st-accent)",
                width: 24,
                height: 24,
                borderRadius: "50%",
                marginBottom: 16,
              }}
            />
            <h2 className="auth-page-heading" style={{ marginBottom: 8 }}>
              Password updated
            </h2>
            <p className="auth-page-subhead" style={{ marginBottom: 24 }}>
              Your account is now secured with your new password.
            </p>
            <button
              type="button"
              onClick={handleContinue}
              className="auth-submit-btn auth-submit-btn--inline"
              style={{
                background: "var(--st-accent)",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Continue to dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-topbar">
        <StewardLogo size={22} />
      </div>

      <div className="auth-centered-page">
        <div className="auth-form-well">
          <div
            className="auth-rule-dot"
            style={{
              background: "var(--st-alert)",
              width: 10,
              height: 10,
              borderRadius: "50%",
              marginBottom: 12,
            }}
          />
          <h2 className="auth-page-heading">Set your password</h2>
          <p className="auth-page-subhead">
            Your account was created with a temporary password. Choose a permanent one before
            continuing.
          </p>

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div>
              <label htmlFor="fcp-current" className="auth-label">
                Temporary password
              </label>
              <input
                id="fcp-current"
                type="password"
                required
                autoComplete="current-password"
                placeholder="Enter the temporary password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="auth-input auth-input--tall"
              />
            </div>

            <div>
              <label htmlFor="fcp-new" className="auth-label">
                New password
              </label>
              <input
                id="fcp-new"
                type="password"
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="auth-input auth-input--tall"
              />
            </div>

            <div>
              <label htmlFor="fcp-confirm" className="auth-label">
                Confirm new password
              </label>
              <input
                id="fcp-confirm"
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
              <RuleRow ok={differentFromCurrent} label="Different from temporary password" />
            </div>

            {error && <ErrorBanner message={error} />}

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
              {loading ? "Saving…" : "Set password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
