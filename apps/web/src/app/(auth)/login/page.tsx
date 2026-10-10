"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "@/lib/api";
import { setAuthCookie, useAuth } from "@/lib/auth";
import { StewardLogo, ErrorBanner } from "../_components";

function decodeRole(token: string): string {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded.role ?? "user";
  } catch {
    return "user";
  }
}

const dueItems = [
  { name: "Tunde Balogun", when: "Overdue since 15 Sep", amount: "USD 300", overdue: true },
  { name: "Blessing Adeyemi", when: "Due 22 Sep", amount: "NGN 150,000", overdue: false },
  { name: "Emeka Nwosu", when: "Due 25 Sep", amount: "NGN 180,000", overdue: false },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();
  const justRegistered = searchParams.get("registered") === "1";
  const passwordReset = searchParams.get("reset") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api.auth.login({ email, password });
      const { data } = result as { data: { access_token: string; refresh_token: string } };
      const store = keepSignedIn ? localStorage : sessionStorage;
      store.setItem("access_token", data.access_token);
      store.setItem("refresh_token", data.refresh_token);
      setAuthCookie(data.access_token);
      // Sync auth context before navigating so the layout doesn't see user=null
      await refreshUser();
      const next = searchParams.get("next");
      if (next && next.startsWith("/")) {
        router.push(next);
      } else {
        const role = decodeRole(data.access_token);
        router.push(role === "link" ? "/worker" : "/manager");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-login-grid">
      {/* Left — light, data preview */}
      <div className="auth-login-left">
        <StewardLogo size={26} />

        <div className="auth-login-preview">
          <div className="auth-login-preview__kicker">Due this week</div>
          <div className="auth-login-preview__list">
            {dueItems.map((d) => (
              <div key={d.name} className="auth-login-preview__row">
                <div>
                  <div className="auth-login-preview__name">{d.name}</div>
                  <div className="auth-login-preview__when">{d.when}</div>
                </div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: "17px",
                    fontVariantNumeric: "tabular-nums",
                    color: d.overdue ? "var(--st-alert)" : "var(--st-text)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {d.amount}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="auth-login-preview__caption">
          A snapshot of what is waiting for you inside.
        </div>
      </div>

      {/* Right — form panel */}
      <div className="auth-login-right">
        {passwordReset && (
          <div className="auth-info-banner">
            Password updated. Sign in with your new password.
          </div>
        )}
        {justRegistered && (
          <div className="auth-info-banner">Account created. Sign in to continue.</div>
        )}

        <h2 className="auth-login-heading">Welcome back</h2>
        <p className="auth-login-subhead">Sign in to record payments and check what is due.</p>

        <form onSubmit={handleSubmit} className="auth-login-form">
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
              className="auth-input"
            />
          </div>

          <div>
            <div className="auth-login-password-row">
              <label htmlFor="password" className="auth-label auth-label--bare">
                Password
              </label>
              <Link href="/forgot-password" className="auth-login-forgot">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
            />
          </div>

          <label className="auth-checkbox-label">
            <input
              type="checkbox"
              checked={keepSignedIn}
              onChange={(e) => setKeepSignedIn(e.target.checked)}
              className="auth-checkbox"
            />
            Keep me signed in on this device
          </label>

          {error && <ErrorBanner message={error} />}

          <button
            type="submit"
            disabled={loading}
            className="auth-submit-btn auth-submit-btn--full"
            style={{
              background: loading ? "var(--st-neutral-400)" : "var(--st-accent)",
              color: "#fff",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="auth-login-footer">
          New here?{" "}
          <Link href="/register">Create an account</Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
