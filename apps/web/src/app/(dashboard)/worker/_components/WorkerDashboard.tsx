"use client";

import { useWorkerNextPayment, useWorkerPayouts, useWorkerDetails } from "@/lib/hooks/useManagerDashboard";

function formatCurrency(amount: number, currency: string) {
  if (currency === "NGN") return `₦${(amount / 100).toLocaleString("en-NG")}`;
  if (currency === "USD") return `$${(amount / 100).toLocaleString("en-US")}`;
  return `${currency} ${(amount / 100).toLocaleString()}`;
}

function daysFromNow(isoDate: string) {
  const diff = Math.round((new Date(isoDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 0) return `${Math.abs(diff)} days ago`;
  return `${diff} days from now`;
}

function statusTagClass(status: string): { className: string; label: string } {
  const s = status.toLowerCase();
  if (s === "completed") return { className: "st-tag st-tag--ok", label: "Paid" };
  if (s === "failed") return { className: "st-tag st-tag--alert", label: "Failed" };
  return { className: "st-tag st-tag--pending", label: "Pending" };
}

export default function WorkerDashboard() {
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const { data: nextPayment } = useWorkerNextPayment();
  const { data: payoutsData } = useWorkerPayouts();
  const { data: details } = useWorkerDetails();
  const payouts = payoutsData ?? [];

  const currentYear = new Date().getFullYear();
  const ytdPayouts = payouts.filter(
    (p) => p.paid_at && new Date(p.paid_at).getFullYear() === currentYear && p.status.toLowerCase() === "completed"
  );
  const ytdTotal = ytdPayouts.reduce((sum, p) => sum + p.total_amount, 0);
  const currency = ytdPayouts[0]?.currency ?? nextPayment?.currency ?? "NGN";
  const onTimeCount = ytdPayouts.length;
  const totalCount = payouts.filter((p) => p.status.toLowerCase() === "completed").length;
  const onTimeRate = totalCount > 0 ? Math.round((onTimeCount / totalCount) * 100) : 100;

  const managerName = details?.manager_name ?? "—";
  const startDate = details?.start_date
    ? new Date(details.start_date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
    : null;

  const tiles = [
    {
      label: "Total received (YTD)",
      value: ytdTotal > 0 ? formatCurrency(ytdTotal, currency) : "—",
      note: onTimeCount > 0 ? `${onTimeCount} payment${onTimeCount !== 1 ? "s" : ""}` : "No payouts yet",
    },
    {
      label: "On-time rate",
      value: totalCount > 0 ? `${onTimeRate}%` : "—",
      note: totalCount > 0 ? "All on schedule" : "No payouts yet",
    },
    {
      label: "Manager",
      value: managerName,
      note: startDate ? `Since ${startDate}` : "—",
    },
  ];

  const recentPayouts = payouts.slice(0, 6);

  const trendData = (() => {
    if (payouts.length === 0) return [
      { month: "Feb", h: 60 }, { month: "Mar", h: 60 }, { month: "Apr", h: 60 },
      { month: "May", h: 70 }, { month: "Jun", h: 60 }, { month: "Jul", h: 70 },
      { month: "Aug", h: 60 }, { month: "Sep", h: 60 },
    ];
    const byMonth: Record<string, number> = {};
    payouts
      .filter((p) => p.paid_at && p.status.toLowerCase() === "completed")
      .forEach((p) => {
        const d = new Date(p.paid_at!);
        const key = d.toLocaleDateString("en-GB", { month: "short" });
        byMonth[key] = (byMonth[key] ?? 0) + p.total_amount;
      });
    const months = Object.keys(byMonth);
    if (months.length === 0) return [{ month: "—", h: 4 }];
    const max = Math.max(...Object.values(byMonth));
    return months.map((m) => ({ month: m, h: Math.max(Math.round((byMonth[m] / max) * 140), 4) }));
  })();

  const needsPaymentSetup = details !== undefined && details !== null && !details.payment_method;

  return (
    <>
      {needsPaymentSetup && (
        <div className="wkr-banner">
          <div className="wkr-banner__body">
            <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            Set up your payment details so your manager can record payments to you.
          </div>
          <a href="/worker/details" className="wkr-banner__link">Set up now →</a>
        </div>
      )}

      <header className="wkr-header">
        <div>
          <div className="wkr-kicker">Worker</div>
          <h1 className="wkr-screen-title">Home</h1>
        </div>
        <div className="wkr-date">{today}</div>
      </header>

      <div className="wkr-body">
        {/* Next payment hero + tiles */}
        <div className="wkr-hero-row">
          <div className="wkr-hero-left">
            <div className="wkr-hero-sub">Your next payment is due</div>
            {nextPayment ? (
              <>
                <div className="wkr-hero-dates">
                  <span className="wkr-hero-weekday">
                    {new Date(nextPayment.next_due_date).toLocaleDateString("en-GB", { weekday: "long" })}
                  </span>
                  <span className="wkr-hero-big">
                    {new Date(nextPayment.next_due_date).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
                  </span>
                  <span className="wkr-hero-big">
                    {new Date(nextPayment.next_due_date).getFullYear()}
                  </span>
                </div>
                <div className="wkr-hero-amount-row">
                  <span className="wkr-hero-amount">
                    {formatCurrency(nextPayment.base_amount, nextPayment.currency)}
                  </span>
                  <span className="wkr-hero-schedule">{nextPayment.pay_schedule}</span>
                </div>
                <div className="wkr-hero-due">{daysFromNow(nextPayment.next_due_date)}</div>
              </>
            ) : (
              <>
                <div className="wkr-hero-dates">
                  <span className="wkr-hero-big wkr-hero-big--muted">Wednesday</span>
                  <span className="wkr-hero-big">1 October</span>
                  <span className="wkr-hero-big">2026</span>
                </div>
                <div className="wkr-hero-amount-row">
                  <span className="wkr-hero-amount">₦250,000</span>
                  <span className="wkr-hero-schedule">Monthly</span>
                </div>
                <div className="wkr-hero-due">7 days from now</div>
              </>
            )}
          </div>

          <div className="wkr-tiles">
            {tiles.map((t) => (
              <div key={t.label} className="wkr-tile">
                <div className="wkr-tile-label">{t.label}</div>
                <div className="wkr-tile-value">{t.value}</div>
                <div className="wkr-tile-note">{t.note}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Chart + Recent payouts */}
        <div className="wkr-chart-row">
          <div className="wkr-chart-left">
            <h4 className="wkr-chart-title">Payments received</h4>
            <div className="wkr-bar-chart">
              {trendData.map((m, i) => (
                <div key={m.month} className="wkr-bar-col">
                  <div
                    title={m.month}
                    style={{
                      height: `${m.h}px`,
                      background: i === trendData.length - 1 ? "var(--st-accent)" : "var(--st-surface)",
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="wkr-bar-labels">
              {trendData.map((m) => (
                <div key={`${m.month}-label`} className="wkr-bar-label">{m.month}</div>
              ))}
            </div>
          </div>

          <div className="wkr-payouts-panel">
            <h4 className="wkr-payouts-title">Recent payouts</h4>
            <div className="wkr-payouts-scroll">
              <table className="wkr-payouts-table">
                <thead>
                  <tr>
                    {["Period", "Amount", "Status"].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentPayouts.length > 0 ? recentPayouts.map((p) => {
                    const tag = statusTagClass(p.status);
                    return (
                      <tr key={p.id}>
                        <td>{p.period_label}</td>
                        <td>{formatCurrency(p.total_amount, p.currency)}</td>
                        <td><span className={tag.className}>{tag.label}</span></td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={3} className="wkr-payouts-empty">No payouts recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
