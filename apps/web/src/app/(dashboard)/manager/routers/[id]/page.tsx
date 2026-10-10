"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type RouterDetail, type LinkSummary } from "@/lib/api";
import { Toast, type ToastState } from "@/components/ds/Toast";
import { Select } from "@/components/ds/Select";

const ROUTER_TYPES = [
  { value: "flint", label: "GL.iNet Flint" },
  { value: "gli_net", label: "GL.iNet (other)" },
  { value: "others", label: "Other" },
];

function statusClass(s: string): string {
  const v = s.toLowerCase();
  if (["with_link"].includes(v)) return "st-tag st-tag--ok";
  if (["in_transit"].includes(v)) return "st-tag st-tag--pending";
  if (["offline", "lost"].includes(v)) return "st-tag st-tag--alert";
  return "st-tag st-tag--neutral";
}

function fmtStatus(s: string): string {
  const map: Record<string, string> = {
    with_manager: "With manager",
    with_link: "With worker",
    in_transit: "In transit",
    offline: "Offline",
    lost: "Lost",
  };
  return map[s] ?? s;
}

export default function RouterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [detail, setDetail] = useState<RouterDetail | null>(null);
  const [links, setLinks] = useState<LinkSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Edit form state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", router_type: "flint", model_number: "", routes_to: "", ip_addr: "" });
  const [saving, setSaving] = useState(false);

  // Assign state
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      api.manager.getRouter(id),
      api.manager.links(),
    ])
      .then(([rRes, lRes]) => {
        const d = rRes.data!;
        setDetail(d);
        setEditForm({
          name: d.name,
          router_type: d.router_type,
          model_number: d.model_number ?? "",
          routes_to: d.routes_to,
          ip_addr: d.ip_addr,
        });
        setLinks((lRes.data ?? []).filter((l) => l.status === "Active" || l.status === "active"));
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setToast({ type: "error", message: "Failed to load router" });
      });
  }

  useEffect(() => { load(); }, [id]);

  function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    api.manager
      .updateRouter(id, {
        name: editForm.name.trim(),
        router_type: editForm.router_type,
        model_number: editForm.model_number.trim() || undefined,
        routes_to: editForm.routes_to.trim(),
        ip_addr: editForm.ip_addr.trim(),
      })
      .then(() => {
        setSaving(false);
        setEditOpen(false);
        setToast({ type: "success", message: "Router updated" });
        load();
      })
      .catch((err: Error) => {
        setSaving(false);
        setToast({ type: "error", message: err.message ?? "Failed to update router" });
      });
  }

  function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setAssigning(true);
    const link_id = selectedLink || null;
    api.manager
      .assignRouter(id, link_id)
      .then(() => {
        setAssigning(false);
        setAssignOpen(false);
        setToast({ type: "success", message: link_id ? "Router assigned" : "Router unassigned" });
        load();
      })
      .catch((err: Error) => {
        setAssigning(false);
        setToast({ type: "error", message: err.message ?? "Failed to assign router" });
      });
  }

  if (loading) {
    return (
      <div style={{ padding: "28px", display: "flex", flexDirection: "column", gap: 12 }}>
        {[180, 260, 220].map((w) => (
          <div key={w} className="ds-skeleton" style={{ height: 20, width: w, borderRadius: 3 }} />
        ))}
      </div>
    );
  }

  if (!detail) {
    return (
      <div style={{ padding: "28px" }}>
        <Link href="/manager/routers" style={{ fontSize: 13, color: "var(--st-neutral-700)", textDecoration: "none" }}>
          ← Routers
        </Link>
        <p style={{ marginTop: 24, color: "var(--st-neutral-700)" }}>Router not found.</p>
      </div>
    );
  }

  const assignOptions = [
    { value: "", label: "Unassigned" },
    ...links.map((l) => ({ value: l.id, label: l.worker_name })),
  ];

  return (
    <>
      {toast && <Toast state={toast} onDismiss={() => setToast(null)} />}

      {/* Page header */}
      <header
        className="ds-page-header"
        style={{
          padding: "18px 28px",
          borderBottom: "2px solid var(--st-divider)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <Link
            href="/manager/routers"
            style={{ fontSize: 12, color: "var(--st-neutral-600)", textDecoration: "none", letterSpacing: "0.04em" }}
          >
            ← Routers
          </Link>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: "4px 0 0", letterSpacing: "-0.025em", fontFamily: "'Archivo', system-ui, sans-serif" }}>
            {detail.name}
          </h1>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="st-btn st-btn--secondary"
            onClick={() => setEditOpen(true)}
          >
            Edit
          </button>
          <button
            type="button"
            className="st-btn st-btn--primary"
            onClick={() => {
              setSelectedLink(detail.current_link_id ?? "");
              setAssignOpen(true);
            }}
          >
            {detail.current_link_id ? "Reassign" : "Assign"}
          </button>
        </div>
      </header>

      {/* Detail fields */}
      <div className="ds-page-body" style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 0 }}>
        {/* Status badge */}
        <div style={{ marginBottom: 24 }}>
          <span className={statusClass(detail.status)}>{fmtStatus(detail.status)}</span>
        </div>

        <div style={{ borderTop: "2px solid var(--st-divider)" }}>
          {[
            { label: "Router type", value: ROUTER_TYPES.find((t) => t.value === detail.router_type)?.label ?? detail.router_type },
            { label: "Model number", value: detail.model_number ?? "—" },
            { label: "Routes to", value: detail.routes_to },
            { label: "IP address", value: detail.ip_addr },
            { label: "Assigned to", value: detail.current_link_name ?? "Unassigned" },
          ].map((row) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 16,
                padding: "14px 0",
                borderBottom: "1px solid var(--st-divider)",
                fontSize: 15,
              }}
            >
              <span style={{ color: "var(--st-neutral-700)", flexShrink: 0 }}>{row.label}</span>
              <span style={{ fontWeight: 600, textAlign: "right", fontFamily: row.label === "IP address" ? "monospace" : undefined }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Edit modal ── */}
      {editOpen && (
        <div
          className="st-scrim"
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditOpen(false); }}
        >
          <style>{`
            @media (min-width: 900px) {
              .rtr-edit-sheet { max-width: 480px !important; padding: 28px !important; margin: auto !important; align-self: center !important; }
              .rtr-edit-handle { display: none !important; }
            }
          `}</style>
          <div
            className="rtr-edit-sheet"
            style={{ background: "var(--st-bg)", width: "100%", padding: "10px 20px calc(30px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 16, maxHeight: "90vh", overflowY: "auto" }}
            role="dialog"
            aria-modal="true"
            aria-label="Edit router"
          >
            <div className="rtr-edit-handle" style={{ width: 40, height: 4, background: "var(--st-divider)", borderRadius: 2, alignSelf: "center" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Edit router</h2>
              <button type="button" onClick={() => setEditOpen(false)} aria-label="Close" style={{ width: 44, height: 44, background: "none", border: "none", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--st-text)" }}>
                <svg width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleEdit} noValidate style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="st-field">
                <label className="st-label" htmlFor="re-name">Router name *</label>
                <input id="re-name" type="text" className="st-input" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="st-field">
                <label className="st-label" htmlFor="re-type">Router type *</label>
                <Select id="re-type" value={editForm.router_type} onChange={(v) => setEditForm((f) => ({ ...f, router_type: v }))} options={ROUTER_TYPES} />
              </div>
              <div className="st-field">
                <label className="st-label" htmlFor="re-model">Model number</label>
                <input id="re-model" type="text" className="st-input" value={editForm.model_number} onChange={(e) => setEditForm((f) => ({ ...f, model_number: e.target.value }))} placeholder="e.g. GL-AX1800" />
              </div>
              <div className="st-field">
                <label className="st-label" htmlFor="re-routes">Routes to *</label>
                <input id="re-routes" type="text" className="st-input" value={editForm.routes_to} onChange={(e) => setEditForm((f) => ({ ...f, routes_to: e.target.value }))} required />
              </div>
              <div className="st-field">
                <label className="st-label" htmlFor="re-ip">IP address *</label>
                <input id="re-ip" type="text" className="st-input" value={editForm.ip_addr} onChange={(e) => setEditForm((f) => ({ ...f, ip_addr: e.target.value }))} required />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                <button type="submit" disabled={saving} className="st-btn st-btn--primary st-btn--lg st-btn--block">
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button type="button" onClick={() => setEditOpen(false)} className="st-btn st-btn--secondary st-btn--lg st-btn--block">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Assign modal ── */}
      {assignOpen && (
        <div
          className="st-scrim"
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setAssignOpen(false); }}
        >
          <style>{`
            @media (min-width: 900px) {
              .rtr-assign-sheet { max-width: 420px !important; padding: 28px !important; margin: auto !important; align-self: center !important; }
              .rtr-assign-handle { display: none !important; }
            }
          `}</style>
          <div
            className="rtr-assign-sheet"
            style={{ background: "var(--st-bg)", width: "100%", padding: "10px 20px calc(30px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 16, maxHeight: "90vh", overflowY: "auto" }}
            role="dialog"
            aria-modal="true"
            aria-label="Assign router"
          >
            <div className="rtr-assign-handle" style={{ width: 40, height: 4, background: "var(--st-divider)", borderRadius: 2, alignSelf: "center" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
                {detail.current_link_id ? "Reassign router" : "Assign router"}
              </h2>
              <button type="button" onClick={() => setAssignOpen(false)} aria-label="Close" style={{ width: 44, height: 44, background: "none", border: "none", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--st-text)" }}>
                <svg width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <p style={{ fontSize: 14, color: "var(--st-neutral-700)", margin: 0 }}>
              {links.length === 0
                ? "No active workers to assign. Add an active link first."
                : "Choose a worker to assign this router to, or select Unassigned to return it to inventory."}
            </p>

            <form onSubmit={handleAssign} noValidate style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="st-field">
                <label className="st-label" htmlFor="as-link">Worker</label>
                <Select
                  id="as-link"
                  value={selectedLink}
                  onChange={(v) => setSelectedLink(v)}
                  options={assignOptions}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                <button type="submit" disabled={assigning || links.length === 0} className="st-btn st-btn--primary st-btn--lg st-btn--block">
                  {assigning ? "Saving…" : selectedLink ? "Assign router" : "Unassign router"}
                </button>
                <button type="button" onClick={() => setAssignOpen(false)} className="st-btn st-btn--secondary st-btn--lg st-btn--block">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
