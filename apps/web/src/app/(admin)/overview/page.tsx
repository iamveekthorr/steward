"use client";

import { useEffect, useState } from "react";
import { api, type AdminStats } from "@/lib/api";
import { PageHeader } from "@/components/ds/PageHeader";

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div
      style={{
        background: "var(--st-surface)",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      <div className="st-kicker" style={{ color: "var(--st-neutral-600)" }}>{label}</div>
      <div
        className="st-num"
        style={{ fontSize: "32px", fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.1 }}
      >
        {value}
      </div>
      {sub && <div className="st-small" style={{ color: "var(--st-neutral-600)" }}>{sub}</div>}
    </div>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat().format(n);
}

function fmtMoney(cents: number) {
  if (cents === 0) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(cents / 100);
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin.stats()
      .then((res) => { if (res.data) setStats(res.data); })
      .catch((e) => setError(e.message ?? "Failed to load stats"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="ds-page">
      <PageHeader role="Admin" title="Overview" />

      {error && (
        <div style={{ color: "var(--st-alert)", padding: "12px 0", fontSize: "14px" }}>{error}</div>
      )}

      {loading && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: "12px",
            marginTop: "24px",
          }}
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              style={{ background: "var(--st-surface)", height: "100px", animation: "pulse 1.5s ease-in-out infinite" }}
            />
          ))}
        </div>
      )}

      {stats && (
        <>
          <section style={{ marginTop: "24px" }}>
            <div className="st-overline" style={{ marginBottom: "12px" }}>Platform</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: "12px",
              }}
            >
              <KpiCard label="Total users" value={fmt(stats.total_users)} />
              <KpiCard
                label="Managers"
                value={fmt(stats.total_managers)}
                sub={`${fmt(stats.pending_managers)} pending · ${fmt(stats.verified_managers)} verified`}
              />
              <KpiCard
                label="Links"
                value={fmt(stats.total_links)}
                sub={`${fmt(stats.active_links)} active`}
              />
              <KpiCard
                label="Payouts"
                value={fmt(stats.total_payouts)}
                sub={stats.total_payout_amount > 0 ? `${fmtMoney(stats.total_payout_amount)} total` : undefined}
              />
            </div>
          </section>

          {stats.pending_managers > 0 && (
            <section
              style={{
                marginTop: "32px",
                padding: "16px 20px",
                background: "var(--st-accent-100)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div className="st-row-title" style={{ color: "var(--st-accent-700)" }}>
                  {stats.pending_managers} manager{stats.pending_managers !== 1 ? "s" : ""} awaiting verification
                </div>
                <div className="st-small" style={{ color: "var(--st-accent-600)", marginTop: "2px" }}>
                  Review and verify or suspend their accounts.
                </div>
              </div>
              <a
                href="/admin/managers"
                style={{
                  background: "var(--st-accent)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "13px",
                  padding: "8px 16px",
                  textDecoration: "none",
                  letterSpacing: "0.01em",
                  whiteSpace: "nowrap",
                }}
              >
                Review managers →
              </a>
            </section>
          )}
        </>
      )}
    </div>
  );
}
