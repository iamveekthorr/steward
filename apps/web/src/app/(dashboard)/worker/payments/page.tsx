"use client";

import Link from "next/link";
import { useWorkerPayouts, useWorkerDetails } from "@/lib/hooks/useManagerDashboard";
import type { PayoutSummary } from "@/lib/api";

function fmtAmount(minor: number, currency: string) {
  return `${currency.toUpperCase()} ${(minor / 100).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
  })}`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusTag(s: string) {
  const v = s.toLowerCase();
  if (["paid", "completed", "verified"].includes(v)) return "st-tag st-tag--ok";
  if (["pending", "pending_review", "in_transit"].includes(v)) return "st-tag st-tag--pending";
  if (["overdue", "failed", "lost"].includes(v)) return "st-tag st-tag--alert";
  return "st-tag st-tag--neutral";
}

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function WorkerPaymentsPage() {
  const { data, isLoading: loading, error: swrError, mutate } = useWorkerPayouts();
  const { data: details } = useWorkerDetails();
  const payouts: PayoutSummary[] = data ?? [];
  const error = swrError ? (swrError instanceof Error ? swrError.message : "Failed to load payment history") : null;
  const needsPaymentSetup = details !== undefined && details !== null && !details.payment_method;

  const year = new Date().getFullYear();
  const paidThisYear = payouts
    .filter((p) => p.paid_at && new Date(p.paid_at).getFullYear() === year)
    .reduce((sum, p) => sum + p.total_amount, 0);
  const currency = payouts[0]?.currency ?? "NGN";
  const failedCount = payouts.filter((p) => ["failed", "overdue"].includes(p.status.toLowerCase())).length;

  return (
    <>
      <header className="st-header ds-page-header">
        <div>
          <div className="st-kicker-m" style={{ marginBottom: 4 }}>Worker</div>
          <h1 className="st-screen-title">Payments</h1>
        </div>
      </header>
      {needsPaymentSetup && (
        <div
          style={{
            background: "var(--st-accent-900)",
            color: "#fff",
            padding: "12px var(--st-page-x)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <span className="st-small" style={{ fontWeight: 600 }}>
            Your manager can&apos;t pay you yet — you need to add your bank details first.
          </span>
          <Link
            href="/worker/details"
            className="st-small"
            style={{ fontWeight: 700, color: "#8dc5c0", textDecoration: "underline", whiteSpace: "nowrap" }}
          >
            Set up now →
          </Link>
        </div>
      )}

      <div className="ds-page-body" style={{ paddingTop: 20 }}>
        {/* KPI stat grid */}
        <div className="st-statgrid" style={{ marginBottom: 24, paddingTop: 4 }}>
          <div>
            <div className="st-overline">Received in {year}</div>
            <div className="st-statgrid__v">
              {loading ? <span className="st-skel" style={{ display: "inline-block", width: 100, height: 20 }} /> : fmtAmount(paidThisYear, currency)}
            </div>
          </div>
          <div>
            <div className="st-overline">Payments</div>
            <div className="st-statgrid__v">
              {loading
                ? <span className="st-skel" style={{ display: "inline-block", width: 40, height: 20 }} />
                : `${payouts.length}${failedCount > 0 ? ` · ${failedCount} failed` : ""}`}
            </div>
          </div>
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "var(--st-rule)" }}>
                <div className="st-skel" style={{ width: 40, height: 40, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="st-skel" style={{ height: 14, width: "50%", marginBottom: 8 }} />
                  <div className="st-skel" style={{ height: 12, width: "35%" }} />
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="st-skel" style={{ height: 14, width: 80, marginBottom: 6 }} />
                  <div className="st-skel" style={{ height: 18, width: 60 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{ padding: "16px 0" }}>
            <p className="st-small" style={{ color: "var(--st-alert-700)", marginBottom: 12 }}>{error}</p>
            <button type="button" onClick={() => mutate()} className="st-btn st-btn--secondary">
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && payouts.length === 0 && (
          <div className="st-empty" style={{ alignItems: "center", padding: "48px 0", maxWidth: "none" }}>
            <div className="st-empty__icon">
              <svg width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24">
                <path d="M12 2v20M2 12h20" />
              </svg>
            </div>
            <h2 className="st-empty__title">No payments yet</h2>
            <p className="st-small" style={{ color: "var(--st-neutral-800)", maxWidth: 520 }}>
              Your manager hasn&apos;t recorded any payouts yet. They&apos;ll appear here once payments start.
            </p>
          </div>
        )}

        {/* Payout list rows */}
        {!loading && !error && payouts.length > 0 && (
          <div>
            {payouts.map((p) => (
              <div key={p.id} className="st-row">
                <div className="st-iconbox" style={{ flexShrink: 0 }}>
                  <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24">
                    <path d="M2 12h20M12 2v20" />
                  </svg>
                </div>
                <div className="st-row__main">
                  <div className="st-row-title">{p.period_label}</div>
                  <div className="st-meta">
                    {fmtDate(p.paid_at)}
                    {p.proof_of_payment ? (
                      <>
                        {" · "}
                        <a
                          href={p.proof_of_payment}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "var(--st-accent-700)" }}
                        >
                          Proof
                        </a>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="st-row__end">
                  <span className="st-row__amount">{fmtAmount(p.total_amount, p.currency)}</span>
                  <span className={`${statusTag(p.status)} st-tag--sm`}>{statusLabel(p.status)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
