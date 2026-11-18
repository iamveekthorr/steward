"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, type AdminManagerDto } from "@/lib/api";
import { PageHeader } from "@/components/ds/PageHeader";
import { StatusBadge } from "@/components/ds/StatusBadge";

function relDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

type ActionKey = "verify" | "suspend" | "revoke" | "approve_quota";

export default function AdminManagersPage() {
  const [managers, setManagers] = useState<AdminManagerDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "verified" | "suspended" | "revoked">("all");

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.admin.managers()
      .then((res) => { if (res.data) setManagers(res.data); })
      .catch((e) => setError(e.message ?? "Failed to load managers"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runAction(mgr: AdminManagerDto, action: ActionKey) {
    const key = `${mgr.id}:${action}`;
    setActionLoading(key);
    setError(null);
    try {
      if (action === "verify") await api.admin.verifyManager(mgr.id);
      else if (action === "suspend") await api.admin.suspendManager(mgr.id);
      else if (action === "revoke") await api.admin.revokeManager(mgr.id);
      else if (action === "approve_quota") await api.admin.approveLinksQuota(mgr.id);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  }

  const filtered = filter === "all" ? managers : managers.filter((m) => m.status === filter);

  const counts = managers.reduce<Record<string, number>>(
    (acc, m) => { acc[m.status] = (acc[m.status] ?? 0) + 1; return acc; },
    {},
  );

  const btnStyle = (variant: "primary" | "ghost" | "danger"): React.CSSProperties => ({
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    padding: "5px 10px",
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
    background:
      variant === "primary"
        ? "var(--st-accent)"
        : variant === "danger"
        ? "var(--st-alert-100)"
        : "var(--st-neutral-200)",
    color:
      variant === "primary"
        ? "#fff"
        : variant === "danger"
        ? "var(--st-alert-700)"
        : "var(--st-neutral-800)",
  });

  return (
    <div className="ds-page">
      <PageHeader
        role="Admin"
        title="Managers"
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

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "4px", marginTop: "20px", flexWrap: "wrap" }}>
        {(["all", "pending", "verified", "suspended", "revoked"] as const).map((f) => {
          const count = f === "all" ? managers.length : (counts[f] ?? 0);
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                background: filter === f ? "var(--st-text)" : "var(--st-neutral-200)",
                color: filter === f ? "var(--st-on-dark)" : "var(--st-neutral-700)",
              }}
            >
              {f} {count > 0 && <span style={{ opacity: 0.7 }}>({count})</span>}
            </button>
          );
        })}
      </div>

      {error && (
        <div style={{ color: "var(--st-alert)", padding: "12px 0", fontSize: "14px", fontWeight: 600 }}>{error}</div>
      )}

      <div style={{ marginTop: "16px" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: "72px", background: "var(--st-surface)", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--st-neutral-600)" }}>
            No managers in this filter.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {filtered.map((mgr) => {
              const isActing = actionLoading?.startsWith(mgr.id);
              return (
                <div
                  key={mgr.id}
                  style={{
                    background: "var(--st-surface)",
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    flexWrap: "wrap",
                  }}
                >
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <div className="st-row-title">
                      {mgr.first_name} {mgr.last_name}
                    </div>
                    <div className="st-small" style={{ color: "var(--st-neutral-600)", marginTop: "2px" }}>
                      {mgr.email}
                    </div>
                    <div className="st-small" style={{ color: "var(--st-neutral-500)", marginTop: "2px" }}>
                      Joined {relDate(mgr.created_at)}
                      {mgr.links_quota_approved && (
                        <span style={{ marginLeft: "8px", color: "var(--st-accent-600)" }}>· quota approved</span>
                      )}
                    </div>
                  </div>

                  <StatusBadge status={mgr.status} />

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {mgr.status === "pending" && (
                      <button
                        type="button"
                        disabled={isActing}
                        onClick={() => runAction(mgr, "verify")}
                        style={btnStyle("primary")}
                      >
                        {actionLoading === `${mgr.id}:verify` ? "…" : "Verify"}
                      </button>
                    )}
                    {(mgr.status === "pending" || mgr.status === "verified") && (
                      <button
                        type="button"
                        disabled={isActing}
                        onClick={() => runAction(mgr, "suspend")}
                        style={btnStyle("danger")}
                      >
                        {actionLoading === `${mgr.id}:suspend` ? "…" : "Suspend"}
                      </button>
                    )}
                    {mgr.status !== "revoked" && (
                      <button
                        type="button"
                        disabled={isActing}
                        onClick={() => runAction(mgr, "revoke")}
                        style={btnStyle("danger")}
                      >
                        {actionLoading === `${mgr.id}:revoke` ? "…" : "Revoke"}
                      </button>
                    )}
                    {mgr.status === "verified" && !mgr.links_quota_approved && (
                      <button
                        type="button"
                        disabled={isActing}
                        onClick={() => runAction(mgr, "approve_quota")}
                        style={btnStyle("ghost")}
                      >
                        {actionLoading === `${mgr.id}:approve_quota` ? "…" : "Approve quota"}
                      </button>
                    )}
                    <Link
                      href={`/admin/subscriptions?manager=${mgr.id}`}
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        padding: "5px 10px",
                        background: "transparent",
                        color: "var(--st-accent-700)",
                        border: "1px solid var(--st-accent-300)",
                        textDecoration: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Subscription
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
