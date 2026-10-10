"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type RouterSummary } from "@/lib/api";
import { PageHeader } from "@/components/ds/PageHeader";
import { DataTable } from "@/components/ds/DataTable";
import { StatusBadge } from "@/components/ds/StatusBadge";
import { Toast, type ToastState } from "@/components/ds/Toast";
import { Select } from "@/components/ds/Select";

const HEADERS = ["Router", "Type", "Model", "Routes to", "IP address", "Status", "Assigned to"];

const ROUTER_TYPES = [
  { value: "flint", label: "GL.iNet Flint" },
  { value: "gli_net", label: "GL.iNet (other)" },
  { value: "others", label: "Other" },
];

interface RegisterForm {
  name: string;
  router_type: string;
  model_number: string;
  routes_to: string;
  ip_addr: string;
}

const EMPTY_FORM: RegisterForm = { name: "", router_type: "flint", model_number: "", routes_to: "", ip_addr: "" };

export default function RoutersPage() {
  const nav = useRouter();
  const [routers, setRouters] = useState<RouterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<RegisterForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof RegisterForm, string>>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api.manager
      .routers()
      .then((res) => {
        setRouters(res.data ?? []);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message ?? "Failed to load routers");
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
  }, []);

  function validate() {
    const e: Partial<Record<keyof RegisterForm, string>> = {};
    if (!form.name.trim()) e.name = "Router name is required";
    if (!form.routes_to.trim()) e.routes_to = "Routes to is required";
    if (!form.ip_addr.trim()) e.ip_addr = "IP address is required";
    setFormErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    api.manager
      .createRouter({
        name: form.name.trim(),
        router_type: form.router_type,
        model_number: form.model_number.trim() || undefined,
        routes_to: form.routes_to.trim(),
        ip_addr: form.ip_addr.trim(),
      })
      .then(() => {
        setSaving(false);
        setShowModal(false);
        setForm(EMPTY_FORM);
        setToast({ type: "success", message: "Router registered" });
        load();
      })
      .catch((err: Error) => {
        setSaving(false);
        setToast({ type: "error", message: err.message ?? "Failed to register router" });
      });
  }

  return (
    <>
      <PageHeader
        role="Manager"
        title="Routers"
        actions={
          <button
            type="button"
            className="st-btn st-btn--primary"
            onClick={() => {
              setForm(EMPTY_FORM);
              setFormErrors({});
              setShowModal(true);
            }}
          >
            Register router
          </button>
        }
      />

      {toast && <Toast state={toast} onDismiss={() => setToast(null)} />}

      <div className="ds-page-body">
        <DataTable
          headers={HEADERS}
          loading={loading}
          error={error}
          onRetry={load}
          hasData={routers.length > 0}
          empty={{
            icon: "router",
            title: "No routers yet",
            description:
              "Register your routers so you can ship them to workers and track custody from here.",
          }}
        >
          {routers.map((rt) => (
            <tr
              key={rt.id}
              style={{ cursor: "pointer" }}
              onClick={() => nav.push(`/manager/routers/${rt.id}`)}
            >
              <td style={{ fontWeight: 800 }}>{rt.name}</td>
              <td>{rt.router_type}</td>
              <td className="st-meta">{rt.model_number ?? "—"}</td>
              <td className="st-meta">{rt.routes_to}</td>
              <td style={{ fontVariantNumeric: "tabular-nums", fontFamily: "monospace" }}>
                {rt.ip_addr}
              </td>
              <td><StatusBadge status={rt.status} /></td>
              <td className="st-meta">{rt.current_link_name ?? "Unassigned"}</td>
            </tr>
          ))}
        </DataTable>
      </div>

      {showModal && (
        <div
          className="st-scrim st-scrim--sheet"
          style={{ zIndex: 100 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div
            className="rtr-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Register router"
          >
            <div className="rtr-handle" />
            <div className="st-dialog__hdr">
              <h2 className="st-dialog__title">Register router</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Close"
                className="st-iconbtn"
              >
                <svg width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleRegister} noValidate className="st-form">
              <div className="st-field">
                <label className="st-label" htmlFor="rtr-name">Router name *</label>
                <input
                  id="rtr-name"
                  type="text"
                  className="st-input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Lagos Office Router"
                />
                {formErrors.name && <span className="st-error-text">{formErrors.name}</span>}
              </div>

              <div className="st-field">
                <label className="st-label" htmlFor="rtr-type">Router type *</label>
                <Select
                  id="rtr-type"
                  value={form.router_type}
                  onChange={(v) => setForm((f) => ({ ...f, router_type: v }))}
                  options={ROUTER_TYPES}
                />
              </div>

              <div className="st-field">
                <label className="st-label" htmlFor="rtr-model">Model number</label>
                <input
                  id="rtr-model"
                  type="text"
                  className="st-input"
                  value={form.model_number}
                  onChange={(e) => setForm((f) => ({ ...f, model_number: e.target.value }))}
                  placeholder="e.g. GL-AX1800, GL-MT6000"
                />
              </div>

              <div className="st-field">
                <label className="st-label" htmlFor="rtr-routes-to">Routes to *</label>
                <input
                  id="rtr-routes-to"
                  type="text"
                  className="st-input"
                  value={form.routes_to}
                  onChange={(e) => setForm((f) => ({ ...f, routes_to: e.target.value }))}
                  placeholder="e.g. Starlink, MTN, Airtel"
                />
                {formErrors.routes_to && <span className="st-error-text">{formErrors.routes_to}</span>}
              </div>

              <div className="st-field">
                <label className="st-label" htmlFor="rtr-ip">IP address *</label>
                <input
                  id="rtr-ip"
                  type="text"
                  className="st-input"
                  value={form.ip_addr}
                  onChange={(e) => setForm((f) => ({ ...f, ip_addr: e.target.value }))}
                  placeholder="e.g. 192.168.8.1"
                />
                {formErrors.ip_addr && <span className="st-error-text">{formErrors.ip_addr}</span>}
              </div>

              <div className="st-form__actions">
                <button type="submit" disabled={saving} className="st-btn st-btn--primary st-btn--lg st-btn--block">
                  {saving ? "Registering…" : "Register router"}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="st-btn st-btn--secondary st-btn--lg st-btn--block">
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
