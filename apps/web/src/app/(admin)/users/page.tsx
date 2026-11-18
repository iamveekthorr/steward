"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ds/PageHeader";

type UserRow = { id: string; first_name: string; last_name: string; email: string; created_at: string };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    api.admin.users()
      .then((res) => { if (res.data) setUsers(res.data as unknown as UserRow[]); })
      .catch((e) => setError(e.message ?? "Failed to load users"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const q = search.toLowerCase();
  const filtered: UserRow[] = users.filter(
    (u) =>
      !q ||
      u.first_name.toLowerCase().includes(q) ||
      u.last_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q),
  );

  function relDate(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  }

  return (
    <div className="ds-page">
      <PageHeader role="Admin" title="Users" />

      <div style={{ marginTop: "20px" }}>
        <input
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            maxWidth: "380px",
            padding: "8px 12px",
            fontSize: "14px",
            fontFamily: "inherit",
            background: "var(--color-surface-raised)",
            border: "1px solid var(--color-surface-border)",
            color: "var(--st-text)",
            outline: "none",
          }}
        />
      </div>

      {error && (
        <div style={{ color: "var(--st-alert)", padding: "12px 0", fontSize: "14px", fontWeight: 600 }}>{error}</div>
      )}

      <div style={{ marginTop: "16px" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ height: "56px", background: "var(--st-surface)", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr auto",
                gap: "0 16px",
                padding: "6px 20px",
                borderBottom: "var(--st-hair)",
              }}
            >
              {["Name", "Email", "Joined"].map((h) => (
                <span key={h} className="st-kicker" style={{ color: "var(--st-neutral-600)" }}>{h}</span>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "4px" }}>
              {filtered.map((u) => (
                <div
                  key={u.id}
                  style={{
                    background: "var(--st-surface)",
                    padding: "10px 20px",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr auto",
                    gap: "0 16px",
                    alignItems: "center",
                  }}
                >
                  <div className="st-row-title" style={{ fontSize: "14px" }}>
                    {u.first_name} {u.last_name}
                  </div>
                  <div className="st-small" style={{ color: "var(--st-neutral-700)", wordBreak: "break-all" }}>{u.email}</div>
                  <div className="st-small" style={{ color: "var(--st-neutral-500)", whiteSpace: "nowrap" }}>
                    {relDate(u.created_at)}
                  </div>
                </div>
              ))}
            </div>
            <div className="st-small" style={{ color: "var(--st-neutral-500)", padding: "12px 20px 0" }}>
              {filtered.length} of {users.length} users
            </div>
          </>
        )}
      </div>
    </div>
  );
}
