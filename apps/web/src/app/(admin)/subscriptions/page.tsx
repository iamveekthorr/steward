"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, type SubscriptionDto, type AdminManagerDto } from "@/lib/api";
import { PageHeader } from "@/components/ds/PageHeader";
import { StatusBadge } from "@/components/ds/StatusBadge";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function isActionable(status: SubscriptionDto["status"]) {
  return status === "pending_payment" || status === "expired" || status === "suspended";
}

interface ActivateFormProps {
  managerId: string;
  onDone: () => void;
  onCancel: () => void;
}

function ActivateForm({ managerId, onDone, onCancel }: ActivateFormProps) {
  const paymentRefRef = useRef<HTMLInputElement>(null);
  const monthsRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    fontSize: "14px",
    fontFamily: "inherit",
    background: "var(--color-surface-raised)",
    border: "1px solid var(--color-surface-border)",
    color: "var(--st-text)",
    outline: "none",
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payment_ref = paymentRefRef.current?.value.trim() || undefined;
      const months = Number(monthsRef.current?.value ?? 1) || 1;
      await api.admin.activateSubscription(managerId, { payment_ref, months });
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Activation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      style={{
        background: "var(--st-accent-100)",
        border: "1px solid var(--st-accent-300)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        minWidth: "260px",
      }}
    >
      <div className="st-kicker" style={{ color: "var(--st-accent)" }}>Activate subscription</div>

      <div>
        <label
          style={{ display: "block", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--st-neutral-700)", marginBottom: "4px" }}
        >
          Payment ref
        </label>
        <input ref={paymentRefRef} type="text" placeholder="Transaction ID or reference" style={inputStyle} />
      </div>

      <div>
        <label
          style={{ display: "block", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--st-neutral-700)", marginBottom: "4px" }}
        >
          Months
        </label>
        <input ref={monthsRef} type="number" min={1} max={24} defaultValue={1} style={{ ...inputStyle, width: "80px" }} />
      </div>

      {error && <div style={{ fontSize: "13px", color: "var(--st-alert)", fontWeight: 600 }}>{error}</div>}

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          type="submit"
          disabled={loading}
          style={{
            background: "var(--st-accent)",
            color: "#fff",
            fontWeight: 700,
            fontSize: "13px",
            padding: "7px 14px",
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Activating…" : "Activate"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            background: "transparent",
            color: "var(--st-neutral-700)",
            fontWeight: 700,
            fontSize: "13px",
            padding: "7px 14px",
            border: "1px solid var(--st-neutral-300)",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function SubscriptionsPage() {
  const searchParams = useSearchParams();
  const filterManagerId = searchParams.get("manager");

  const [subs, setSubs] = useState<SubscriptionDto[]>([]);
  const [managers, setManagers] = useState<AdminManagerDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.admin.subscriptions().catch(() => ({ data: [] as SubscriptionDto[] })),
      api.admin.managers().catch(() => ({ data: [] as AdminManagerDto[] })),
    ])
      .then(([subsRes, mgrsRes]) => {
        if (subsRes.data) setSubs(subsRes.data);
        if (mgrsRes.data) setManagers(mgrsRes.data);
      })
      .catch((e) => setError(e.message ?? "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const managerMap = new Map(managers.map((m) => [m.id, m]));

  const displayed = filterManagerId
    ? subs.filter((s) => s.manager_id === filterManagerId)
    : subs;

  const filterManager = filterManagerId ? managerMap.get(filterManagerId) : null;

  return (
    <div className="ds-page">
      <PageHeader
        role="Admin"
        title={filterManager ? `Subscriptions — ${filterManager.first_name} ${filterManager.last_name}` : "Subscriptions"}
        actions={
          <button
            type="button"
            onClick={load}
            style={{
              background: "var(--st-neutral-200)",
              border: "none",
              padding: "8px 14px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              color: "var(--st-neutral-800)",
            }}
          >
            Refresh
          </button>
        }
      />

      {filterManagerId && (
        <div style={{ marginTop: "12px" }}>
          <a href="/admin/subscriptions" style={{ fontSize: "13px", color: "var(--st-accent-700)", fontWeight: 600 }}>
            ← All subscriptions
          </a>
        </div>
      )}

      {error && (
        <div style={{ color: "var(--st-alert)", padding: "12px 0", fontSize: "14px", fontWeight: 600 }}>{error}</div>
      )}

      <div style={{ marginTop: "20px" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: "72px", background: "var(--st-surface)", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center", color: "var(--st-neutral-600)" }}>
            {filterManagerId
              ? "No subscription record for this manager yet."
              : "No subscriptions found. Subscriptions are created automatically when a manager account is provisioned."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {displayed.map((sub) => {
              const mgr = managerMap.get(sub.manager_id);
              const isOpen = activatingId === sub.id;
              return (
                <div key={sub.id} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <div
                    style={{
                      background: "var(--st-surface)",
                      padding: "14px 20px",
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                      flexWrap: "wrap",
                    }}
                  >
                    {/* Manager info */}
                    <div style={{ flex: 1, minWidth: "180px" }}>
                      {mgr ? (
                        <>
                          <div className="st-row-title" style={{ fontSize: "14px" }}>
                            {mgr.first_name} {mgr.last_name}
                          </div>
                          <div className="st-small" style={{ color: "var(--st-neutral-600)", marginTop: "2px" }}>
                            {mgr.email}
                          </div>
                        </>
                      ) : (
                        <div className="st-small" style={{ color: "var(--st-neutral-500)" }}>
                          {sub.manager_id.slice(0, 8)}…
                        </div>
                      )}
                    </div>

                    {/* Subscription details */}
                    <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "center" }}>
                      <StatusBadge status={sub.status} />

                      <div>
                        <div className="st-kicker" style={{ color: "var(--st-neutral-600)" }}>Started</div>
                        <div className="st-small" style={{ fontWeight: 600 }}>{fmtDate(sub.started_at)}</div>
                      </div>

                      <div>
                        <div className="st-kicker" style={{ color: "var(--st-neutral-600)" }}>Expires</div>
                        <div
                          className="st-small"
                          style={{
                            fontWeight: 600,
                            color: sub.expires_at && new Date(sub.expires_at) < new Date()
                              ? "var(--st-alert)"
                              : "inherit",
                          }}
                        >
                          {fmtDate(sub.expires_at)}
                        </div>
                      </div>

                      {sub.payment_ref && (
                        <div>
                          <div className="st-kicker" style={{ color: "var(--st-neutral-600)" }}>Ref</div>
                          <div className="st-small" style={{ fontWeight: 600, fontFamily: "monospace" }}>
                            {sub.payment_ref}
                          </div>
                        </div>
                      )}

                      {sub.grace_until && (
                        <div>
                          <div className="st-kicker" style={{ color: "var(--st-alert)" }}>Grace until</div>
                          <div className="st-small" style={{ fontWeight: 600, color: "var(--st-alert)" }}>
                            {fmtDate(sub.grace_until)}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action */}
                    {isActionable(sub.status) && (
                      <button
                        type="button"
                        onClick={() => setActivatingId(isOpen ? null : sub.id)}
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                          padding: "6px 12px",
                          border: "none",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          background: "var(--st-accent)",
                          color: "#fff",
                        }}
                      >
                        {isOpen ? "Cancel" : "Activate"}
                      </button>
                    )}
                  </div>

                  {isOpen && (
                    <div style={{ padding: "0 20px 12px" }}>
                      <ActivateForm
                        managerId={sub.manager_id}
                        onDone={() => { setActivatingId(null); load(); }}
                        onCancel={() => setActivatingId(null)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
