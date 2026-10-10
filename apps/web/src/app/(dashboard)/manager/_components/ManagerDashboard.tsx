"use client";

import Link from "next/link";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { api, type LinkSummary } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  useManagerKpis,
  useManagerCharts,
  useManagerLinks,
} from "@/lib/hooks/useManagerDashboard";
import { EmptyState } from "@/components/ds/EmptyState";
import { MoneyInput } from "@/components/ds/MoneyInput";
import { Select } from "@/components/ds/Select";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildCalendar(dueDates: Set<string>) {
  const today = new Date();
  const days = [];
  for (let i = 0; i < 28; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    days.push({
      day: d.getDate(),
      isoDate: iso,
      isToday: i === 0,
      hasDue: dueDates.has(iso),
    });
  }
  return days;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAmount(minor: number, currency: string) {
  const major = minor / 100;
  if (currency === "NGN") return `₦${major.toLocaleString("en-NG")}`;
  if (currency === "USD") return `$${major.toLocaleString("en-US")}`;
  return `${currency} ${major.toLocaleString()}`;
}

function fmtTrendLabel(minor: number) {
  const major = minor / 100;
  if (major >= 1_000_000) return `${(major / 1_000_000).toFixed(2)}M`;
  if (major >= 1_000) return `${(major / 1_000).toFixed(0)}k`;
  return String(major);
}

function statusTagClass(status: string): string {
  if (status === "Overdue" || status === "Due soon") return "st-tag st-tag--alert";
  return "st-tag st-tag--ok";
}

// ── Record Payment Modal ──────────────────────────────────────────────────────

interface RecordPaymentModalProps {
  links: LinkSummary[];
  managerName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

function RecordPaymentModal({ links, managerName, onClose, onSuccess }: RecordPaymentModalProps) {
  const [linkId, setLinkId] = useState(links[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.manager.recordPayment({
        link_id: linkId,
        base_amount: Math.round(Number(amount) * 100),
        currency,
        paid_at: new Date(paidAt).toISOString(),
        notes: notes || undefined,
      });
      // Fire payment notification email — best-effort, don't block success
      const link = links.find((l) => l.id === linkId);
      if (link?.worker_email) {
        fetch("/api/email/payment-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: link.worker_email,
            workerName: link.worker_name,
            amount: (Number(amount)).toLocaleString("en-NG"),
            currency,
            payDate: new Date(paidAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
            managerName,
          }),
        }).catch(() => {});
      }
      setDone(true);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="st-scrim" style={{ zIndex: 50 }}>
      <div className="st-dialog" style={{ maxWidth: "460px", padding: "28px" }}>
        <div className="st-dialog__hdr" style={{ marginBottom: "20px" }}>
          <h2 className="st-dialog__title">Record payment</h2>
          <button type="button" onClick={onClose} className="st-iconbtn" aria-label="Close">
            ×
          </button>
        </div>

        {done ? (
          <div className="mgr-success">
            <div className="mgr-success__icon">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--st-accent)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="st-section-title">Payment recorded</p>
            <button
              type="button"
              onClick={onClose}
              className="st-btn st-btn--primary"
              style={{ marginTop: "16px" }}
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="st-form">
            <div className="st-field">
              <label htmlFor="rp-link" className="st-label">Worker</label>
              <Select
                id="rp-link"
                value={linkId}
                onChange={setLinkId}
                options={
                  links.length > 0
                    ? links.map((l) => ({ value: l.id, label: `${l.worker_name} — ${l.job_type}` }))
                    : [{ value: "", label: "No links found", disabled: true }]
                }
              />
            </div>

            <div className="st-form__2col-asym">
              <div className="st-field">
                <label htmlFor="rp-amount" className="st-label">Amount</label>
                <MoneyInput
                  id="rp-amount"
                  value={amount}
                  onChange={setAmount}
                  placeholder="0.00"
                />
              </div>
              <div className="st-field">
                <label htmlFor="rp-currency" className="st-label">Currency</label>
                <Select
                  id="rp-currency"
                  value={currency}
                  onChange={setCurrency}
                  options={["NGN", "USD", "GBP", "EUR"].map((c) => ({ value: c, label: c }))}
                />
              </div>
            </div>

            <div className="st-field">
              <label htmlFor="rp-date" className="st-label">Date paid</label>
              <input
                id="rp-date"
                type="date"
                required
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="st-input"
              />
            </div>

            <div className="st-field">
              <label htmlFor="rp-notes" className="st-label">Notes (optional)</label>
              <textarea
                id="rp-notes"
                rows={2}
                placeholder="e.g. September salary"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="st-input"
                style={{ resize: "none" }}
              />
            </div>

            {error && <div className="st-banner">{error}</div>}

            <div className="mgr-form-actions">
              <button type="button" onClick={onClose} className="st-btn st-btn--secondary">
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || links.length === 0}
                className="st-btn st-btn--primary"
              >
                {loading ? "Recording…" : "Record payment"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Invite Worker Modal ───────────────────────────────────────────────────────

interface InviteWorkerModalProps {
  onClose: () => void;
  onAdded: () => void;
}

function InviteWorkerModal({ onClose, onAdded }: InviteWorkerModalProps) {
  const [workerEmail, setWorkerEmail] = useState("");
  const [jobType, setJobType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [homeCountry, setHomeCountry] = useState("");
  const [workCountry, setWorkCountry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.manager.createLink({
        worker_email: workerEmail,
        job_type: jobType,
        start_date: new Date(startDate).toISOString(),
        home_country: homeCountry,
        work_country: workCountry,
      });
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add worker");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="st-scrim" style={{ zIndex: 50 }}>
      <div className="st-dialog" style={{ maxWidth: "460px", padding: "28px" }}>
        <div className="st-dialog__hdr" style={{ marginBottom: "8px" }}>
          <h2 className="st-dialog__title">Invite a worker</h2>
          <button type="button" onClick={onClose} className="st-iconbtn" aria-label="Close">
            ×
          </button>
        </div>

        <p className="st-small mgr-modal-desc">
          Enter the worker&apos;s email address. They must already have a Steward account.
        </p>

        <form onSubmit={handleSubmit} className="st-form">
          <div className="st-field">
            <label htmlFor="iw-email" className="st-label">Worker email</label>
            <input
              id="iw-email"
              type="email"
              required
              aria-required="true"
              placeholder="worker@example.com"
              value={workerEmail}
              onChange={(e) => setWorkerEmail(e.target.value)}
              className="st-input"
            />
          </div>
          <div className="st-field">
            <label htmlFor="iw-job" className="st-label">Job type</label>
            <input
              id="iw-job"
              required
              aria-required="true"
              placeholder="e.g. House assistant, Driver"
              value={jobType}
              onChange={(e) => setJobType(e.target.value)}
              className="st-input"
            />
          </div>
          <div className="st-form__2col">
            <div className="st-field">
              <label htmlFor="iw-home" className="st-label">Home country</label>
              <input
                id="iw-home"
                required
                aria-required="true"
                placeholder="Nigeria"
                value={homeCountry}
                onChange={(e) => setHomeCountry(e.target.value)}
                className="st-input"
              />
            </div>
            <div className="st-field">
              <label htmlFor="iw-work" className="st-label">Work country</label>
              <input
                id="iw-work"
                required
                aria-required="true"
                placeholder="Nigeria"
                value={workCountry}
                onChange={(e) => setWorkCountry(e.target.value)}
                className="st-input"
              />
            </div>
          </div>
          <div className="st-field">
            <label htmlFor="iw-start" className="st-label">Start date</label>
            <input
              id="iw-start"
              type="date"
              required
              aria-required="true"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="st-input"
            />
          </div>

          {error && <div className="st-banner">{error}</div>}

          <div className="mgr-form-actions">
            <button type="button" onClick={onClose} className="st-btn st-btn--secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="st-btn st-btn--primary">
              {loading ? "Adding…" : "Add link"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ManagerDashboard() {
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const { user } = useAuth();
  const managerName = user ? `${user.first_name} ${user.last_name}` : "Your manager";

  const { mutate } = useSWRConfig();
  const { data: kpiData, isLoading: kpisLoading } = useManagerKpis();
  const { data: chartsData } = useManagerCharts();
  const { data: linksData, mutate: mutateLinks } = useManagerLinks();

  const dataLoading = kpisLoading;
  const links: LinkSummary[] = linksData ?? [];

  const [showPayment, setShowPayment] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  const trendPoints = chartsData?.monthly_trend ?? [];
  const maxTrend = Math.max(...trendPoints.map((m) => m.total), 1);

  const statusBreakdown = chartsData?.status_breakdown ?? {
    on_schedule: 0,
    overdue: 0,
    pending_invite: 0,
    inactive: 0,
  };
  const statusTotal =
    statusBreakdown.on_schedule +
    statusBreakdown.overdue +
    statusBreakdown.pending_invite +
    statusBreakdown.inactive || 1;

  const statusRows = [
    { label: "On schedule", count: statusBreakdown.on_schedule, fill: "var(--st-neutral-800)" },
    { label: "Overdue", count: statusBreakdown.overdue, fill: "var(--st-alert-700)" },
    { label: "Pending invite", count: statusBreakdown.pending_invite, fill: "#8dc5c0" },
    { label: "Inactive", count: statusBreakdown.inactive, fill: "#9e9b9b" },
  ];

  const kpis = [
    {
      label: "Active links",
      value: dataLoading ? "…" : kpiData ? String(kpiData.active_links) : "0",
      note: dataLoading
        ? ""
        : kpiData && (statusBreakdown.pending_invite > 0 || statusBreakdown.inactive > 0)
          ? `${statusBreakdown.pending_invite} pending · ${statusBreakdown.inactive} inactive`
          : kpiData
            ? "No pending or inactive links"
            : "",
      valueColor: "var(--st-text)",
    },
    {
      label: "Due this week",
      value: dataLoading ? "…" : kpiData ? String(kpiData.due_this_week) : "0",
      note: dataLoading
        ? ""
        : kpiData?.due_this_week_amounts?.length
          ? kpiData.due_this_week_amounts.map((a) => fmtAmount(a.total, a.currency)).join(" + ")
          : kpiData
            ? "Nothing due in 7 days"
            : "",
      valueColor: "var(--st-text)",
    },
    {
      label: "Overdue",
      value: dataLoading ? "…" : kpiData ? String(kpiData.overdue_links) : "0",
      note: dataLoading
        ? ""
        : kpiData?.overdue_worker
          ? `${kpiData.overdue_worker.name} · ${kpiData.overdue_worker.days_overdue} days`
          : kpiData
            ? "All payments on schedule"
            : "",
      valueColor: kpiData && kpiData.overdue_links > 0 ? "var(--st-alert-700)" : "var(--st-text)",
    },
    {
      label: "Paid this month",
      value: dataLoading ? "…" : kpiData ? fmtAmount(kpiData.paid_this_month, "NGN") : "₦0",
      note: dataLoading
        ? ""
        : kpiData && kpiData.paid_this_month_payouts > 0
          ? `NGN equivalent · ${kpiData.paid_this_month_payouts} payouts`
          : kpiData
            ? "No payouts recorded this month"
            : "",
      valueColor: kpiData && kpiData.paid_this_month > 0 ? "var(--st-accent)" : "var(--st-text)",
    },
  ];

  const attention = chartsData?.needs_attention ?? [];
  const dueDates = new Set(attention.map((a) => a.due_date.slice(0, 10)));
  const calDays = buildCalendar(dueDates);

  return (
    <>
      {/* ── Header ── */}
      <header className="mgr-header">
        <div className="mgr-title">
          <div className="mgr-kicker">Manager overview</div>
          <h1 className="mgr-screen-title">Dashboard</h1>
        </div>

        <div className="mgr-date">{today}</div>

        <button type="button" className="mgr-bell" aria-label="Notifications">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span
            className="mgr-bell__dot"
            style={{ display: attention.length > 0 ? "grid" : "none" }}
          >
            {attention.length}
          </span>
        </button>

        <div className="mgr-ctas">
          <button
            type="button"
            onClick={() => setShowPayment(true)}
            className="st-btn st-btn--secondary"
          >
            Record payment
          </button>
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="st-btn st-btn--primary"
          >
            Add link
          </button>
        </div>
      </header>

      <div style={{ flex: 1, paddingBottom: "56px" }}>
        {/* ── KPI tiles ── */}
        <div className="mgr-kpis">
          {kpis.map((k) => (
            <div key={k.label} className="mgr-kpi-cell">
              <div className="mgr-kpi-label">{k.label}</div>
              {dataLoading ? (
                <>
                  <div className="st-skel" style={{ height: "40px", width: "80px", marginTop: "10px", borderRadius: "2px" }} />
                  <div className="st-skel" style={{ height: "12px", width: "120px", marginTop: "8px", borderRadius: "2px" }} />
                </>
              ) : (
                <>
                  <div className="mgr-kpi-value" style={{ color: k.valueColor }}>{k.value}</div>
                  <div className="mgr-kpi-note">{k.note}</div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* ── Chart row ── */}
        <div className="mgr-chart-row">
          {/* Monthly trend */}
          <div className="mgr-chart-left">
            <div className="mgr-section-hdr">
              <h4 className="mgr-section-title">Monthly payout trend</h4>
              <div className="mgr-section-kicker">NGN equivalent · 12 months</div>
            </div>
            {trendPoints.length === 0 ? (
              <EmptyState
                icon="receipt"
                title="No payment data yet"
                description="Record a payment to see monthly payout trends here."
                action={{ label: "Record payment", onClick: () => setShowPayment(true) }}
              />
            ) : (
              <div className="mgr-bar-chart">
                {trendPoints.map((m, i) => {
                  const pct = (m.total / maxTrend) * 100;
                  return (
                    <div key={m.month} className="mgr-bar-col">
                      <div className="mgr-bar-col__val">{fmtTrendLabel(m.total)}</div>
                      <div
                        title={`${m.month}: ${fmtAmount(m.total, "NGN")}`}
                        style={{
                          height: `${Math.max(pct, 4)}%`,
                          background: i === trendPoints.length - 1
                            ? "var(--st-accent)"
                            : "var(--st-neutral-800)",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mgr-bar-labels">
              {trendPoints.map((m) => (
                <div key={`${m.month}-lbl`} className="mgr-bar-label">{m.month}</div>
              ))}
            </div>
          </div>

          {/* Payment status + currency */}
          <div className="mgr-chart-right">
            <h4 className="mgr-section-title" style={{ marginBottom: "14px" }}>Payment status</h4>

            {statusTotal <= 1 && !chartsData ? (
              <div className="mgr-stacked-bar" style={{ background: "var(--st-surface)" }} />
            ) : (
              <div className="mgr-stacked-bar">
                {statusRows.map((s) => (
                  <div
                    key={s.label}
                    style={{
                      width: `${(s.count / statusTotal) * 100}%`,
                      background: s.fill,
                      minWidth: s.count > 0 ? "4px" : "0",
                    }}
                    title={`${s.label}: ${s.count}`}
                  />
                ))}
              </div>
            )}

            <div className="mgr-legend">
              {statusRows.map((s) => (
                <div key={s.label} className="mgr-legend-row">
                  <div className="mgr-legend-dot" style={{ background: s.fill }} />
                  <span className="mgr-legend-label">{s.label}</span>
                  <span className="mgr-legend-val">{s.count}</span>
                </div>
              ))}
            </div>

            <h4 className="mgr-section-title" style={{ marginBottom: "14px" }}>Payout by currency</h4>

            {(chartsData?.currency_totals.length ?? 0) > 0 ? (
              <div className="mgr-currency-rows">
                {chartsData?.currency_totals.map((c) => (
                  <div key={c.currency}>
                    <div className="mgr-currency-row__hdr">
                      <span className="mgr-currency-row__name">{c.currency}</span>
                      <span className="mgr-currency-row__amount">{fmtAmount(c.total, c.currency)}</span>
                    </div>
                    <div className="mgr-currency-bar">
                      <div className="mgr-currency-fill" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mgr-no-data">
                {dataLoading ? "Loading…" : "No payouts recorded yet."}
              </p>
            )}
          </div>
        </div>

        {/* ── Paid on time · Paid by link · Automation ── */}
        <div className="mgr-3col">
          {/* Paid on time */}
          <div className="mgr-3col-cell">
            <div className="mgr-section-hdr mgr-section-hdr--sm">
              <h4 className="mgr-section-title">Paid on time</h4>
              <div className="mgr-section-kicker">12 months</div>
            </div>

            <div className="mgr-big-stat">
              <div
                className="mgr-big-num"
                style={{ color: dataLoading ? "var(--st-surface)" : "var(--st-text)" }}
              >
                {dataLoading ? "—" : `${Math.round(chartsData?.on_time_rate ?? 0)}%`}
              </div>
              {!dataLoading && chartsData && chartsData.total_payouts_12mo > 0 && (
                <div className="mgr-big-stat__desc">
                  of {chartsData.total_payouts_12mo} payouts landed on the due date
                </div>
              )}
              {!dataLoading && (!chartsData || chartsData.total_payouts_12mo === 0) && (
                <div className="mgr-big-stat__desc">No payouts in the past 12 months</div>
              )}
            </div>

            {(() => {
              const pts = chartsData?.monthly_punctuality ?? [];
              const maxPts = Math.max(...pts.map((p) => p.on_time + p.late), 1);
              if (pts.length === 0) {
                return (
                  <div className="mgr-punctuality">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div
                        key={`ph-${i}`}
                        className={dataLoading ? "ds-skeleton" : ""}
                        style={{
                          flex: 1,
                          height: `${20 + Math.random() * 36}px`,
                          background: dataLoading ? undefined : "var(--st-surface)",
                        }}
                      />
                    ))}
                  </div>
                );
              }
              return (
                <div className="mgr-punctuality">
                  {pts.map((p) => {
                    const total = p.on_time + p.late;
                    const h = Math.max((total / maxPts) * 100, 8);
                    const color =
                      p.late === 0
                        ? "var(--st-accent)"
                        : p.on_time === 0
                          ? "var(--st-alert-700)"
                          : "var(--st-neutral-800)";
                    return (
                      <div
                        key={p.month}
                        title={`${p.month}: ${p.on_time} on time, ${p.late} late`}
                        style={{ flex: 1, height: `${h}%`, background: color }}
                      />
                    );
                  })}
                </div>
              );
            })()}

            <div className="mgr-footer-stat">
              <span>Average delay when late</span>
              <span className="mgr-footer-stat__val">
                {dataLoading
                  ? "—"
                  : chartsData && chartsData.avg_delay_days > 0
                    ? `${chartsData.avg_delay_days.toFixed(1)} days`
                    : "None"}
              </span>
            </div>
          </div>

          {/* Paid by link */}
          <div className="mgr-3col-cell">
            <div className="mgr-section-hdr mgr-section-hdr--lg">
              <h4 className="mgr-section-title">Paid by link</h4>
              <div className="mgr-section-kicker">Year to date</div>
            </div>

            {(() => {
              const rows = chartsData?.paid_by_link ?? [];
              const maxYtd = Math.max(...rows.map((r) => r.total_ytd), 1);

              if (dataLoading) {
                return (
                  <div className="mgr-link-bars">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={`pbl-sk-${i}`}>
                        <div className="st-skel" style={{ height: "14px", width: "60%", marginBottom: "6px" }} />
                        <div className="st-skel" style={{ height: "6px", width: "100%" }} />
                      </div>
                    ))}
                  </div>
                );
              }

              if (rows.length === 0) {
                return <div className="mgr-empty-center">No payouts recorded this year.</div>;
              }

              return (
                <div className="mgr-link-bars">
                  {rows.map((r, i) => (
                    <div key={r.link_id}>
                      <div className="mgr-link-bar__hdr">
                        <span className="mgr-link-bar__name">{r.worker_name}</span>
                        <span className="mgr-link-bar__amount">{fmtAmount(r.total_ytd, r.currency)}</span>
                      </div>
                      <div className="mgr-link-bar__track">
                        <div
                          className="mgr-link-bar__fill"
                          style={{
                            width: `${(r.total_ytd / maxYtd) * 100}%`,
                            background: i === 0 ? "var(--st-accent)" : "var(--st-neutral-800)",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Automation */}
          <div className="mgr-3col-cell">
            <div className="mgr-section-hdr mgr-section-hdr--sm">
              <h4 className="mgr-section-title">Automation</h4>
              <div className="mgr-section-kicker">Auto-pay</div>
            </div>

            <div className="mgr-big-stat">
              <div
                className="mgr-big-num mgr-big-num--sm"
                style={{ color: dataLoading ? "var(--st-surface)" : "var(--st-text)" }}
              >
                {dataLoading
                  ? "—"
                  : `${chartsData?.automation?.configured ?? 0} of ${chartsData?.automation?.active_total ?? 0}`}
              </div>
              <div className="mgr-big-stat__desc">active links on auto-pay</div>
            </div>

            {(() => {
              const auto = chartsData?.automation;
              const total = auto?.active_total ?? 1;
              const configured = auto?.configured ?? 0;
              const notConfigured = auto?.not_configured ?? 0;
              const manual = Math.max(0, total - configured - notConfigured);

              return (
                <>
                  <div className="mgr-stacked-bar">
                    {dataLoading ? (
                      <div className="st-skel" style={{ flex: 1, height: "100%" }} />
                    ) : (
                      <>
                        <div
                          style={{
                            width: `${(configured / total) * 100}%`,
                            background: "var(--st-accent)",
                            minWidth: configured > 0 ? "4px" : "0",
                            transition: "width 0.6s ease",
                          }}
                          title={`Auto-pay on: ${configured}`}
                        />
                        <div
                          style={{
                            width: `${(manual / total) * 100}%`,
                            background: "var(--st-neutral-800)",
                            minWidth: manual > 0 ? "4px" : "0",
                            transition: "width 0.6s ease",
                          }}
                          title={`Manual: ${manual}`}
                        />
                        <div
                          style={{
                            width: `${(notConfigured / total) * 100}%`,
                            background: "var(--st-surface)",
                            minWidth: notConfigured > 0 ? "4px" : "0",
                            transition: "width 0.6s ease",
                          }}
                          title={`No configuration: ${notConfigured}`}
                        />
                      </>
                    )}
                  </div>

                  <div className="mgr-legend" style={{ marginBottom: "20px" }}>
                    {[
                      { fill: "var(--st-accent)", label: "Auto-pay on", count: configured },
                      { fill: "var(--st-neutral-800)", label: "Manual", count: manual },
                      { fill: "var(--st-surface)", label: "No configuration yet", count: notConfigured },
                    ].map((row) => (
                      <div key={row.label} className="mgr-legend-row">
                        <div className="mgr-legend-dot" style={{ background: row.fill }} />
                        <span className="mgr-legend-label">{row.label}</span>
                        <span className="mgr-legend-val">{dataLoading ? "—" : row.count}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mgr-footer-stat">
                    <span>Manual hours saved this year</span>
                    <span className="mgr-footer-stat__val">
                      {dataLoading
                        ? "—"
                        : `~${Math.round(((chartsData?.automation?.configured ?? 0) * (new Date().getMonth() + 1) * 0.25) * 10) / 10} h`}
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* ── Calendar + Needs attention ── */}
        <div className="mgr-cal-row">
          {/* Calendar */}
          <div className="mgr-cal-cell-wrap">
            <div className="mgr-section-hdr">
              <h4 className="mgr-section-title">Due dates ahead</h4>
              <div className="mgr-section-kicker">Next 28 days</div>
            </div>

            <div className="mgr-cal-weekdays">
              {weekdays.map((w) => (
                <div key={w} className="mgr-cal-weekday">{w}</div>
              ))}
            </div>

            <div className="mgr-cal-grid">
              {calDays.map((c) => (
                <div
                  key={c.isoDate}
                  className="mgr-cal-cell"
                  style={{
                    fontWeight: c.isToday || c.hasDue ? 800 : 400,
                    background: c.isToday
                      ? "var(--st-text)"
                      : c.hasDue
                        ? "var(--st-accent)"
                        : "transparent",
                    color: c.isToday
                      ? "var(--st-bg)"
                      : c.hasDue
                        ? "#fff"
                        : "var(--st-text)",
                  }}
                >
                  {c.day}
                </div>
              ))}
            </div>

            <div className="mgr-cal-legend">
              {[
                { color: "var(--st-accent)", label: "Payment due" },
                { color: "var(--st-text)", label: "Today" },
              ].map((l) => (
                <div key={l.label} className="mgr-cal-legend-item">
                  <div className="mgr-cal-legend-dot" style={{ background: l.color }} />
                  <span className="mgr-cal-legend-label">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Needs attention */}
          <div className="mgr-attn-wrap">
            <div className="mgr-section-hdr">
              <h4 className="mgr-section-title">Needs attention</h4>
              <Link href="/manager/links" className="mgr-all-links">All links</Link>
            </div>

            <div className="mgr-attention-scroll">
              <table className="mgr-attn-table">
                <thead>
                  <tr>
                    {["Link", "Due", "Amount", "Status", ""].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attention.length > 0 ? (
                    attention.map((a) => (
                      <tr key={a.link_id}>
                        <td className="mgr-attn-table__name">{a.worker_name}</td>
                        <td className={a.status === "Overdue" ? "mgr-attn-table__date--overdue" : ""}>
                          {a.due_date}
                        </td>
                        <td className="mgr-attn-table__num">{fmtAmount(a.amount, a.currency)}</td>
                        <td>
                          <span className={statusTagClass(a.status)}>{a.status}</span>
                        </td>
                        <td className="mgr-attn-table__action">
                          <button
                            type="button"
                            onClick={() => setShowPayment(true)}
                            className="mgr-attn-pay"
                          >
                            Pay
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="mgr-empty-center">
                        {dataLoading ? (
                          "Loading…"
                        ) : links.length === 0 ? (
                          <>
                            No workers linked yet.{" "}
                            <button
                              type="button"
                              onClick={() => setShowInvite(true)}
                              className="mgr-link-cta"
                            >
                              Add your first link.
                            </button>
                          </>
                        ) : (
                          "All workers are on schedule."
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {showPayment && (
        <RecordPaymentModal
          links={links}
          managerName={managerName}
          onClose={() => setShowPayment(false)}
          onSuccess={() => {
            mutate("/manager/dashboard/kpis");
            mutate("/manager/dashboard/charts");
          }}
        />
      )}
      {showInvite && (
        <InviteWorkerModal
          onClose={() => setShowInvite(false)}
          onAdded={() => {
            setShowInvite(false);
            mutateLinks();
            mutate("/manager/dashboard/kpis");
          }}
        />
      )}
    </>
  );
}
