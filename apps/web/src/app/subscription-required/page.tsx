"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type PaymentInstructions } from "@/lib/api";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: "4px 10px",
        border: "1px solid var(--st-accent-300)",
        background: "none",
        color: "var(--st-accent-700)",
        cursor: "pointer",
        fontFamily: "inherit",
        whiteSpace: "nowrap",
      }}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 0",
        borderBottom: "1px solid var(--st-divider)",
        gap: 12,
      }}
    >
      <span style={{ fontSize: 13, color: "var(--st-neutral-600)", flexShrink: 0 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, textAlign: "right" }}>{value}</span>
        <CopyButton text={value} />
      </div>
    </div>
  );
}

function parseDetails(raw: string): Array<{ label: string; value: string }> {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) return { label: line, value: "" };
      return {
        label: line.slice(0, idx).trim(),
        value: line.slice(idx + 1).trim(),
      };
    })
    .filter((r) => r.value);
}

export default function SubscriptionRequiredPage() {
  const router = useRouter();
  const [instructions, setInstructions] = useState<PaymentInstructions | null>(null);
  const [loading, setLoading] = useState(true);
  const [ref, setRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.subscription
      .paymentInstructions()
      .then((res) => {
        setInstructions(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ref.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.subscription.submitPaymentRef(ref.trim());
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  const rows = parseDetails(instructions?.details ?? "");

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "40px 20px 60px",
        background: "var(--st-bg)",
        color: "var(--st-text)",
        fontFamily: "var(--st-font, sans-serif)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 520 }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--st-accent-700)",
              marginBottom: 8,
            }}
          >
            Steward
          </div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              margin: "0 0 10px",
            }}
          >
            Subscription required
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--st-neutral-700)", margin: 0 }}>
            Your account needs an active subscription to use Steward. Send payment to the account
            below and submit your transaction reference — the admin will activate your account
            shortly after.
          </p>
        </div>

        {/* Payment details card */}
        <div
          style={{
            border: "2px solid var(--st-text)",
            padding: "20px 20px 4px",
            marginBottom: 28,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--st-accent-700)",
              marginBottom: 16,
            }}
          >
            Send payment to
          </div>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 16 }}>
              {[70, 55, 80, 60].map((w, i) => (
                <div
                  key={i}
                  style={{
                    height: 14,
                    width: `${w}%`,
                    background: "var(--st-neutral-200)",
                    borderRadius: 2,
                  }}
                />
              ))}
            </div>
          ) : rows.length > 0 ? (
            rows.map((r) => <DetailRow key={r.label} label={r.label} value={r.value} />)
          ) : (
            <p style={{ fontSize: 13, color: "var(--st-neutral-600)", paddingBottom: 16 }}>
              Payment details not configured yet. Contact the admin.
            </p>
          )}
        </div>

        {/* Note */}
        {instructions?.note && (
          <div
            style={{
              background: "var(--st-surface)",
              borderLeft: "3px solid var(--st-accent)",
              padding: "12px 14px",
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--st-neutral-700)",
              marginBottom: 28,
            }}
          >
            {instructions.note}
          </div>
        )}

        {/* Submit reference form */}
        {submitted ? (
          <div
            style={{
              background: "var(--st-ok-100, #e6f4f1)",
              border: "1px solid var(--st-ok-300, #8dc5c0)",
              padding: "16px 18px",
              marginBottom: 24,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Reference submitted ✓</div>
            <div style={{ fontSize: 13, color: "var(--st-neutral-700)" }}>
              The admin has been notified and will activate your subscription once the payment is
              confirmed.
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
              Already sent payment? Submit your transaction reference.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                className="st-input"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="e.g. TRF2024ABC123"
                style={{ flex: 1, fontSize: 14 }}
              />
              <button
                type="submit"
                disabled={submitting || !ref.trim()}
                style={{
                  padding: "0 20px",
                  fontWeight: 700,
                  fontSize: 13,
                  border: "none",
                  background: ref.trim() ? "var(--st-accent)" : "var(--st-neutral-300)",
                  color: ref.trim() ? "#fff" : "var(--st-neutral-600)",
                  cursor: ref.trim() ? "pointer" : "not-allowed",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                }}
              >
                {submitting ? "…" : "Submit"}
              </button>
            </div>
            {error && (
              <div style={{ fontSize: 13, color: "var(--st-alert-700)", fontWeight: 600 }}>
                {error}
              </div>
            )}
          </form>
        )}

        {/* Back link */}
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            marginTop: 32,
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            color: "var(--st-neutral-600)",
            padding: 0,
            fontFamily: "inherit",
            textDecoration: "underline",
          }}
        >
          ← Go back
        </button>
      </div>
    </div>
  );
}
