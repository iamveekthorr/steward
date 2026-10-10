"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { StewardLogo, ErrorBanner } from "../_components";

type Role = "manager" | "worker";

function RoleCard({
  selected,
  onSelect,
  title,
  note,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  note: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="auth-role-card"
      style={{
        background: selected ? "var(--st-accent-800)" : "transparent",
        border: `2px solid ${selected ? "var(--st-accent-800)" : "var(--st-divider)"}`,
        color: selected ? "var(--st-bg)" : "var(--st-text)",
      }}
    >
      <div className="auth-role-card__title">{title}</div>
      <div className="auth-role-card__note">{note}</div>
    </button>
  );
}

const bullets = [
  {
    t: "Managers configure",
    d: "Set the schedule, amount and currency once. Due dates are worked out from there.",
  },
  {
    t: "Workers see",
    d: "The next date, the amount, and a receipt for everything already paid.",
  },
  {
    t: "Nobody has to ask",
    d: "Reminders go out before each payment falls due.",
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("manager");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.auth.register({
        first_name: firstName,
        last_name: lastName,
        email,
        password,
      });
      const token = (res as { data?: { verification_token?: string } }).data?.verification_token;
      if (token) {
        fetch("/api/email/verify-address", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: email, name: firstName, token }),
        }).catch(() => {});
      }
      router.push(`/verification-pending?email=${encodeURIComponent(email)}&role=${role}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-register-grid">
      {/* Left — dark teal panel */}
      <div className="auth-register-left">
        <StewardLogo size={26} light />

        <div className="auth-register-left__body">
          <h3 className="auth-register-heading">Two sides of the same record.</h3>
          <div className="auth-register-bullets">
            {bullets.map((b) => (
              <div key={b.t} className="auth-register-bullet">
                <div className="auth-register-bullet__title">{b.t}</div>
                <div className="auth-register-bullet__desc">{b.d}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="auth-register-left__footer">
          Already have an account?{" "}
          <Link href="/login">Sign in</Link>
        </div>
      </div>

      {/* Right — light form panel */}
      <div className="auth-register-right">
        <div className="auth-register-form-well">
          <h2 className="auth-register-heading2">Create your account</h2>
          <p className="auth-register-subhead">
            It takes about a minute. You can add your first worker straight after.
          </p>

          <form onSubmit={handleSubmit} className="auth-register-form">
            {/* Role picker */}
            <div>
              <label className="auth-label auth-label--sm">I am a</label>
              <div className="auth-role-grid">
                <RoleCard
                  selected={role === "manager"}
                  onSelect={() => setRole("manager")}
                  title="Manager"
                  note="I employ people back home"
                />
                <RoleCard
                  selected={role === "worker"}
                  onSelect={() => setRole("worker")}
                  title="Worker"
                  note="I am paid by a manager"
                />
              </div>
            </div>

            {/* Name row */}
            <div className="auth-name-row">
              <div>
                <label htmlFor="first_name" className="auth-label">
                  First name
                </label>
                <input
                  id="first_name"
                  required
                  autoComplete="given-name"
                  placeholder="Ngozi"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="auth-input"
                />
              </div>
              <div>
                <label htmlFor="last_name" className="auth-label">
                  Last name
                </label>
                <input
                  id="last_name"
                  required
                  autoComplete="family-name"
                  placeholder="Adeyinka"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="auth-input"
                />
              </div>
            </div>

            {/* Email */}
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

            {/* Password */}
            <div>
              <label htmlFor="password" className="auth-label">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                placeholder="At least 10 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input"
              />
            </div>

            {/* Manager notice */}
            {role === "manager" && (
              <p className="auth-manager-notice">
                Manager accounts are reviewed before you can add links. Usually within one
                working day.
              </p>
            )}

            {error && <ErrorBanner message={error} />}

            <button
              type="submit"
              disabled={loading}
              className="auth-submit-btn"
              style={{
                background: loading ? "var(--st-neutral-400)" : "var(--st-accent)",
                color: "#fff",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
