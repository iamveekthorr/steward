"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

function hasNumberOrSymbol(s: string) {
  return /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(s);
}

function RuleRow({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="cp-rule">
      <div
        className="cp-rule__dot"
        style={{ background: met ? "var(--st-accent)" : "var(--st-neutral-400)" }}
      />
      <span
        className="cp-rule__text"
        style={{ color: met ? "var(--st-text)" : "var(--st-neutral-500)" }}
      >
        {label}
      </span>
    </div>
  );
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const ruleLength = newPassword.length >= 10;
  const ruleSymbol = hasNumberOrSymbol(newPassword);
  const ruleMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const allRulesMet = ruleLength && ruleSymbol;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!ruleLength) {
      setError("New password must be at least 10 characters");
      return;
    }
    if (!ruleSymbol) {
      setError("New password must contain at least one number or symbol");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password must be different from your current password");
      return;
    }

    setLoading(true);
    try {
      await api.auth.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to change password";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header className="st-header ds-page-header">
        <div>
          <div className="st-kicker-m">Account</div>
          <h1 className="st-screen-title">Change password</h1>
        </div>
      </header>

      <div className="cp-body">
        <div className="cp-inner">
          {success ? (
            <div className="cp-success">
              <p className="cp-success__msg">Password updated successfully.</p>
              <button type="button" onClick={() => router.back()} className="st-btn st-btn--secondary">
                Go back
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="cp-form">
              {error && <div className="cp-error">{error}</div>}

              <div className="st-field">
                <label className="st-label" htmlFor="cp-current">Current password</label>
                <input
                  id="cp-current"
                  type="password"
                  className="st-input"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              <div className="st-field">
                <label className="st-label" htmlFor="cp-new">New password</label>
                <input
                  id="cp-new"
                  type="password"
                  className="st-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="st-field">
                <label className="st-label" htmlFor="cp-confirm">Confirm new password</label>
                <input
                  id="cp-confirm"
                  type="password"
                  className="st-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="cp-rules">
                <RuleRow met={ruleLength} label="At least 10 characters" />
                <RuleRow met={ruleSymbol} label="One number or symbol" />
                <RuleRow met={ruleMatch} label="Passwords match" />
              </div>

              <div className="cp-actions">
                <button
                  type="submit"
                  disabled={loading || !allRulesMet}
                  className="st-btn st-btn--primary"
                >
                  {loading ? "Updating…" : "Save new password"}
                </button>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="st-btn st-btn--secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
