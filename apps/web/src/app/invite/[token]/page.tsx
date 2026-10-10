"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { setAuthCookie, useAuth } from "@/lib/auth";

interface InviteInfo {
  manager_name: string;
  worker_email: string;
  job_type: string;
  start_date: string;
  base_amount: number | null;
  currency: string | null;
  pay_schedule: string | null;
}

function hasNumber(s: string) { return /[0-9]/.test(s); }
function hasSymbol(s: string) { return /[^a-zA-Z0-9]/.test(s); }

function RuleRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", color: ok ? "var(--st-text)" : "var(--st-neutral-600)", fontFamily: "'Archivo', system-ui, sans-serif" }}>
      <span style={{ width: "9px", height: "9px", flex: "none", background: ok ? "var(--st-accent)" : "var(--st-neutral-300)" }} />
      {label}
    </div>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch { return iso; }
}

function formatAmount(amount: number | null, currency: string | null) {
  if (!amount || !currency) return null;
  return `${currency} ${amount.toLocaleString()}`;
}

function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const { refreshUser } = useAuth();
  const token = typeof params.token === "string" ? params.token : "";

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);

  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api.auth
      .getInviteInfo(token)
      .then((res) => setInfo(res.data))
      .catch(() => setExpired(true))
      .finally(() => setLoading(false));
  }, [token]);

  const longEnough = password.length >= 10;
  const hasNumberOrSymbol = hasNumber(password) || hasSymbol(password);
  const canSubmit = longEnough && hasNumberOrSymbol && !submitting;

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.auth.acceptInvite({ token, password });
      if (res.data) {
        localStorage.setItem("access_token", res.data.access_token);
        localStorage.setItem("refresh_token", res.data.refresh_token);
        setAuthCookie(res.data.access_token);
        // Sync auth context before navigating so the layout doesn't see user=null
        await refreshUser();
      }
      router.push("/worker");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  const base = {
    minHeight: "100vh",
    display: "grid" as const,
    gridTemplateColumns: "1fr 600px",
    fontFamily: "'Archivo', system-ui, sans-serif",
    color: "var(--st-text)",
  };
  const leftClass = "auth-invite-left";
  const rightClass = "auth-invite-right";

  if (loading) {
    return (
      <div style={{ ...base, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ gridColumn: "1 / -1", display: "grid", placeItems: "center", minHeight: "100vh" }}>
          <p style={{ fontSize: "16px", color: "var(--st-neutral-600)" }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (expired || !info) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--st-bg)", fontFamily: "'Archivo', system-ui, sans-serif" }}>
        <div style={{ maxWidth: "480px", padding: "48px", textAlign: "center" as const }}>
          <h2 style={{ fontSize: "36px", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 16px" }}>
            This invite has expired
          </h2>
          <p style={{ fontSize: "16px", color: "var(--st-neutral-700)", lineHeight: 1.6, marginBottom: "28px" }}>
            Ask the manager to send a new invite link.
          </p>
          <Link href="/login" style={{ color: "var(--st-accent)", fontWeight: 800, textDecoration: "none", fontSize: "15px" }}>
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  const terms: { k: string; v: string }[] = [
    { k: "Role", v: info.job_type },
    { k: "Start date", v: formatDate(info.start_date) },
    ...(formatAmount(info.base_amount, info.currency) ? [{ k: "Base pay", v: formatAmount(info.base_amount, info.currency)! }] : []),
    ...(info.pay_schedule ? [{ k: "Pay schedule", v: info.pay_schedule }] : []),
  ];

  return (
    <div className="auth-invite-grid" style={base}>
      {/* Left dark panel */}
      <div
        className={leftClass}
        style={{
          background: "var(--st-accent-800)",
          color: "var(--st-bg)",
          padding: "80px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div style={{ fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "var(--st-accent-300)" }}>
          You have been invited
        </div>
        <h2
          style={{
            fontSize: "clamp(36px, 4vw, 52px)",
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.035em",
            margin: "20px 0 0",
            maxWidth: "560px",
          }}
        >
          {info.manager_name} wants to pay you through Steward
        </h2>
        <p
          style={{
            fontSize: "17px",
            lineHeight: 1.6,
            margin: "28px 0 0",
            maxWidth: "480px",
            color: "var(--st-accent-200)",
          }}
        >
          Accepting creates your worker account. You will see every payment date before it arrives
          and be able to download a receipt for each one. You can leave at any time.
        </p>
      </div>

      {/* Right light panel */}
      <div
        className={rightClass}
        style={{
          padding: "72px 64px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "var(--st-bg)",
          borderLeft: "2px solid var(--st-divider)",
        }}
      >
        <div style={{ fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "var(--st-neutral-600)" }}>
          The terms offered
        </div>

        <div style={{ marginTop: "18px", borderTop: "2px solid var(--st-divider)" }}>
          {terms.map((t) => (
            <div
              key={t.k}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "16px",
                padding: "14px 0",
                borderBottom: "1px solid var(--st-divider)",
                fontSize: "15px",
              }}
            >
              <span style={{ color: "var(--st-neutral-700)" }}>{t.k}</span>
              <span style={{ fontWeight: 800, textAlign: "right" as const }}>{t.v}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleAccept} style={{ marginTop: "28px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label
              htmlFor="password"
              style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "6px", color: "var(--st-text)" }}
            >
              Choose a password
            </label>
            <input
              id="password"
              type="password"
              required
              placeholder="At least 10 characters"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                minHeight: "46px",
                padding: "10px 14px",
                border: "1.5px solid var(--st-divider)",
                background: "#fff",
                fontSize: "15px",
                fontFamily: "'Archivo', system-ui, sans-serif",
                outline: "none",
                boxSizing: "border-box" as const,
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
            <RuleRow ok={longEnough} label="At least 10 characters" />
            <RuleRow ok={hasNumberOrSymbol} label="One number or symbol" />
          </div>

          {error && (
            <div
              style={{
                padding: "12px 16px",
                borderLeft: "3px solid #d9534f",
                background: "#fff5f5",
                fontSize: "14px",
                color: "#c0392b",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              padding: "13px 22px",
              background: canSubmit ? "var(--st-accent)" : "var(--st-neutral-300)",
              color: canSubmit ? "#fff" : "var(--st-neutral-600)",
              fontWeight: 800,
              fontSize: "16px",
              border: 0,
              cursor: canSubmit ? "pointer" : "not-allowed",
              fontFamily: "'Archivo', system-ui, sans-serif",
              width: "100%",
              marginTop: "8px",
            }}
          >
            {submitting ? "Setting up account…" : "Accept and set up my account"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/login")}
            style={{
              padding: "12px 22px",
              background: "transparent",
              color: "var(--st-text)",
              fontWeight: 600,
              fontSize: "15px",
              border: "1.5px solid var(--st-divider)",
              cursor: "pointer",
              fontFamily: "'Archivo', system-ui, sans-serif",
              width: "100%",
            }}
          >
            Decline this invitation
          </button>
        </form>
      </div>
    </div>
  );
}

export default function InvitePageWrapper() {
  return (
    <Suspense>
      <InvitePage />
    </Suspense>
  );
}
