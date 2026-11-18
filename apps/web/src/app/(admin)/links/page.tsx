"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type AdminLinkDto } from "@/lib/api";
import { PageHeader } from "@/components/ds/PageHeader";
import { StatusBadge } from "@/components/ds/StatusBadge";

export default function AdminLinksPage() {
  const [links, setLinks] = useState<AdminLinkDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const load = useCallback(() => {
    setLoading(true);
    api.admin.links()
      .then((res) => { if (res.data) setLinks(res.data); })
      .catch((e) => setError(e.message ?? "Failed to load links"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const statuses = Array.from(new Set(links.map((l) => l.status)));

  const filtered = links.filter((l) => {
    const matchStatus = filter === "all" || l.status === filter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      l.worker_name.toLowerCase().includes(q) ||
      l.manager_name.toLowerCase().includes(q) ||
      l.job_type.toLowerCase().includes(q) ||
      l.work_country.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <div className="ds-page">
      <PageHeader role="Admin" title="Links" />

      {/* Controls */}
      <div style={{ display: "flex", gap: "10px", marginTop: "20px", flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="search"
          placeholder="Search worker, manager, country…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: "1",
            minWidth: "200px",
            maxWidth: "340px",
            padding: "8px 12px",
            fontSize: "14px",
            fontFamily: "inherit",
            background: "var(--color-surface-raised)",
            border: "1px solid var(--color-surface-border)",
            color: "var(--st-text)",
            outline: "none",
          }}
        />
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
          {(["all", ...statuses] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={{
                padding: "6px 10px",
                fontSize: "11px",
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
              {f}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ color: "var(--st-alert)", padding: "12px 0", fontSize: "14px", fontWeight: 600 }}>{error}</div>
      )}

      <div style={{ marginTop: "16px" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ height: "64px", background: "var(--st-surface)", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--st-neutral-600)" }}>
            No links found.
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr auto auto",
                gap: "0 16px",
                padding: "6px 20px",
                borderBottom: "var(--st-hair)",
              }}
            >
              {["Worker", "Manager", "Country", "Status"].map((h) => (
                <span key={h} className="st-kicker" style={{ color: "var(--st-neutral-600)" }}>{h}</span>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "4px" }}>
              {filtered.map((link) => (
                <div
                  key={link.id}
                  style={{
                    background: "var(--st-surface)",
                    padding: "12px 20px",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr auto auto",
                    gap: "0 16px",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div className="st-row-title" style={{ fontSize: "14px" }}>{link.worker_name}</div>
                    <div className="st-small" style={{ color: "var(--st-neutral-600)" }}>{link.job_type}</div>
                  </div>
                  <div className="st-small" style={{ color: "var(--st-neutral-700)" }}>{link.manager_name}</div>
                  <div className="st-small" style={{ color: "var(--st-neutral-600)" }}>{link.work_country}</div>
                  <StatusBadge status={link.status} size="sm" />
                </div>
              ))}
            </div>
            <div className="st-small" style={{ color: "var(--st-neutral-500)", padding: "12px 20px 0" }}>
              {filtered.length} of {links.length} links
            </div>
          </>
        )}
      </div>
    </div>
  );
}
