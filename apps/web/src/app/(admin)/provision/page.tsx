"use client";

import { useRef, useState } from "react";
import { api, type CreateManagerAccountResponse } from "@/lib/api";
import { PageHeader } from "@/components/ds/PageHeader";

interface SuccessResult extends CreateManagerAccountResponse {}

export default function ProvisionPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SuccessResult | null>(null);
  const [copied, setCopied] = useState(false);

  const firstRef = useRef<HTMLInputElement>(null);
  const lastRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    const first_name = firstRef.current?.value.trim() ?? "";
    const last_name = lastRef.current?.value.trim() ?? "";
    const email = emailRef.current?.value.trim() ?? "";

    if (!first_name || !last_name || !email) {
      setError("All fields are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.admin.createManagerAccount({ first_name, last_name, email });
      if (res.data) {
        setResult(res.data);
        if (firstRef.current) firstRef.current.value = "";
        if (lastRef.current) lastRef.current.value = "";
        if (emailRef.current) emailRef.current.value = "";
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to provision account");
    } finally {
      setLoading(false);
    }
  }

  async function copyCredentials() {
    if (!result) return;
    const text = `Email: ${result.email}\nTemporary password: ${result.temporary_password}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    fontSize: "15px",
    fontFamily: "inherit",
    background: "var(--color-surface-raised)",
    border: "1px solid var(--color-surface-border)",
    color: "var(--st-text)",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--st-neutral-700)",
    marginBottom: "6px",
  };

  return (
    <div className="ds-page">
      <PageHeader role="Admin" title="Provision Manager" />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,480px) 1fr",
          gap: "32px",
          marginTop: "24px",
          alignItems: "start",
        }}
      >
        {/* Form */}
        <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <p className="st-body" style={{ color: "var(--st-neutral-700)", marginBottom: "0" }}>
              Creates a manager account with a temporary password. Share the credentials securely — the manager must change their password on first login.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label htmlFor="first_name" style={labelStyle}>First name</label>
              <input
                ref={firstRef}
                id="first_name"
                type="text"
                autoComplete="given-name"
                required
                style={inputStyle}
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="last_name" style={labelStyle}>Last name</label>
              <input
                ref={lastRef}
                id="last_name"
                type="text"
                autoComplete="family-name"
                required
                style={inputStyle}
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" style={labelStyle}>Email address</label>
            <input
              ref={emailRef}
              id="email"
              type="email"
              autoComplete="email"
              required
              style={inputStyle}
              disabled={loading}
            />
          </div>

          {error && (
            <div style={{ color: "var(--st-alert)", fontSize: "14px", fontWeight: 600 }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: "var(--st-accent)",
              color: "#fff",
              fontWeight: 800,
              fontSize: "14px",
              letterSpacing: "0.02em",
              padding: "12px 24px",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              fontFamily: "inherit",
              alignSelf: "flex-start",
            }}
          >
            {loading ? "Creating…" : "Create manager account"}
          </button>
        </form>

        {/* Result card */}
        {result && (
          <div
            style={{
              background: "var(--st-accent-100)",
              border: "1.5px solid var(--st-accent-300)",
              padding: "24px",
            }}
          >
            <div
              className="st-kicker"
              style={{ color: "var(--st-accent)", marginBottom: "12px" }}
            >
              Account created
            </div>
            <div className="st-row-title" style={{ marginBottom: "16px" }}>
              Share these credentials securely
            </div>

            <dl style={{ display: "flex", flexDirection: "column", gap: "12px", margin: 0 }}>
              <div>
                <dt style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--st-neutral-700)", marginBottom: "3px" }}>
                  Email
                </dt>
                <dd
                  className="st-num"
                  style={{ margin: 0, fontWeight: 600, fontSize: "15px", wordBreak: "break-all" }}
                >
                  {result.email}
                </dd>
              </div>
              <div>
                <dt style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--st-neutral-700)", marginBottom: "3px" }}>
                  Temporary password
                </dt>
                <dd
                  className="st-num"
                  style={{ margin: 0, fontWeight: 700, fontSize: "17px", letterSpacing: "0.06em", fontFamily: "monospace", color: "var(--st-accent-700)" }}
                >
                  {result.temporary_password}
                </dd>
              </div>
            </dl>

            <div style={{ marginTop: "20px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={copyCredentials}
                style={{
                  background: "var(--st-accent)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "13px",
                  padding: "8px 16px",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {copied ? "Copied!" : "Copy credentials"}
              </button>
              <button
                type="button"
                onClick={() => setResult(null)}
                style={{
                  background: "transparent",
                  color: "var(--st-accent-700)",
                  fontWeight: 700,
                  fontSize: "13px",
                  padding: "8px 16px",
                  border: "1px solid var(--st-accent-300)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Provision another
              </button>
            </div>

            <p
              className="st-small"
              style={{ marginTop: "16px", color: "var(--st-neutral-700)", lineHeight: 1.5 }}
            >
              The manager will be prompted to change their password on first login.
              Do not share these credentials over unencrypted channels.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
