"use client";

import { useEffect, useState } from "react";
import { api, type OvertimePolicySummary } from "@/lib/api";
import { Toast, type ToastState } from "@/components/ds/Toast";
import { EmptyState } from "@/components/ds/EmptyState";
import { Select } from "@/components/ds/Select";
import { MoneyInput } from "@/components/ds/MoneyInput";

function fmtRate(p: OvertimePolicySummary) {
  if (p.multiplier != null) return `${p.multiplier}×`;
  if (p.flat_rate != null) return `₦${p.flat_rate.toLocaleString()}/h`;
  return "—";
}

interface CreateForm {
  name: string;
  overtime_enabled: boolean;
  rate_type: "multiplier" | "flat_rate";
  multiplier: string;
  flat_rate: string;
  threshold_hours: string;
}

const EMPTY_FORM: CreateForm = {
  name: "",
  overtime_enabled: true,
  rate_type: "multiplier",
  multiplier: "1.5",
  flat_rate: "",
  threshold_hours: "8",
};

export default function OvertimePage() {
  const [policies, setPolicies] = useState<OvertimePolicySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CreateForm, string>>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api.manager
      .overtime()
      .then((res) => {
        setPolicies(res.data ?? []);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message ?? "Failed to load overtime policies");
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
  }, []);

  function validate() {
    const e: Partial<Record<keyof CreateForm, string>> = {};
    if (!form.name.trim()) e.name = "Policy name is required";
    if (form.rate_type === "multiplier") {
      const n = parseFloat(form.multiplier);
      if (isNaN(n) || n <= 1) e.multiplier = "Multiplier must be greater than 1";
    }
    if (form.rate_type === "flat_rate") {
      const n = parseFloat(form.flat_rate);
      if (isNaN(n) || n <= 0) e.flat_rate = "Flat rate must be a positive number";
    }
    if (form.threshold_hours) {
      const n = parseFloat(form.threshold_hours);
      if (isNaN(n) || n <= 0) e.threshold_hours = "Threshold must be a positive number";
    }
    setFormErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleCreate(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    api.manager
      .createOvertimePolicy({
        name: form.name.trim(),
        overtime_enabled: form.overtime_enabled,
        multiplier: form.rate_type === "multiplier" ? parseFloat(form.multiplier) : undefined,
        flat_rate: form.rate_type === "flat_rate" ? parseFloat(form.flat_rate) : undefined,
        threshold_hours: form.threshold_hours ? parseFloat(form.threshold_hours) : undefined,
      })
      .then(() => {
        setSaving(false);
        setShowModal(false);
        setForm(EMPTY_FORM);
        setToast({ type: "success", message: "Policy created" });
        load();
      })
      .catch((err: Error) => {
        setSaving(false);
        setToast({ type: "error", message: err.message ?? "Failed to create policy" });
      });
  }

  return (
    <>
      <header className="st-header ds-page-header">
        <div>
          <div className="st-kicker-m" style={{ marginBottom: 4 }}>Manager</div>
          <h1 className="st-screen-title">Overtime policies</h1>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm(EMPTY_FORM);
            setFormErrors({});
            setShowModal(true);
          }}
          className="st-btn st-btn--primary"
        >
          + New policy
        </button>
      </header>

      {toast && <Toast state={toast} onDismiss={() => setToast(null)} />}

      <div className="ds-page-body">
        {loading && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ padding: "12px 0", borderBottom: "var(--st-rule)" }}>
                <div className="st-skel" style={{ height: 14, width: "40%", marginBottom: 8 }} />
                <div className="st-skel" style={{ height: 12, width: "25%" }} />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: "16px 0" }}>
            <p className="st-small" style={{ color: "var(--st-alert-700)", marginBottom: 12 }}>{error}</p>
            <button type="button" onClick={load} className="st-btn st-btn--secondary">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && policies.length === 0 && (
          <EmptyState
            icon="clock"
            title="No overtime policies"
            description="Policies are reusable rules — 1.5× after 40 hours, say — that you attach to any link."
            action={{
              label: "New policy",
              onClick: () => {
                setForm(EMPTY_FORM);
                setFormErrors({});
                setShowModal(true);
              },
            }}
          />
        )}

        {!loading && !error && policies.length > 0 && (
          <div>
            {policies.map((p) => (
              <div key={p.id} className="st-row">
                <div className="st-row__main">
                  <div className="st-row-title">{p.name}</div>
                  <div className="st-meta">
                    {p.multiplier != null ? "Multiplier" : "Flat rate"} · {fmtRate(p)}
                    {p.threshold_hours ? ` · after ${p.threshold_hours}h` : ""}
                  </div>
                </div>
                <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: p.overtime_enabled ? "var(--st-accent)" : "var(--st-neutral-700)",
                    }}
                  />
                  <span className="st-meta">
                    {p.overtime_enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div
          className="st-scrim st-scrim--sheet"
          style={{ zIndex: 100 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div
            className="ot-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="New overtime policy"
          >
            <div className="ot-handle" />
            <div className="st-dialog__hdr">
              <h2 className="st-dialog__title">New overtime policy</h2>
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

            <form onSubmit={handleCreate} noValidate className="st-form">
              <div className="st-field">
                <label className="st-label" htmlFor="ot-name">
                  Policy name *
                </label>
                <input
                  id="ot-name"
                  type="text"
                  className="st-input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Standard overtime"
                />
                {formErrors.name && <span className="st-error-text">{formErrors.name}</span>}
              </div>

              <div className="st-field">
                <label className="st-label" htmlFor="ot-rate-type">
                  Rate type *
                </label>
                <Select
                  id="ot-rate-type"
                  value={form.rate_type}
                  onChange={(v) => setForm((f) => ({ ...f, rate_type: v as "multiplier" | "flat_rate" }))}
                  options={[
                    { value: "multiplier", label: "Multiplier (e.g. 1.5×)" },
                    { value: "flat_rate", label: "Flat rate per hour" },
                  ]}
                />
              </div>

              {form.rate_type === "multiplier" ? (
                <div className="st-field">
                  <label className="st-label" htmlFor="ot-multiplier">
                    Multiplier *
                  </label>
                  <input
                    id="ot-multiplier"
                    type="text"
                    inputMode="decimal"
                    className="st-input"
                    value={form.multiplier}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9.]/g, "").replace(/^(\d*\.?\d*).*/, "$1");
                      setForm((f) => ({ ...f, multiplier: v }));
                    }}
                  />
                  <span className="st-hint">Must be greater than 1. E.g. 1.5 means 1.5× base rate.</span>
                  {formErrors.multiplier && <span className="st-error-text">{formErrors.multiplier}</span>}
                </div>
              ) : (
                <div className="st-field">
                  <label className="st-label" htmlFor="ot-flat-rate">
                    Flat rate (per hour) *
                  </label>
                  <MoneyInput
                    id="ot-flat-rate"
                    value={form.flat_rate}
                    onChange={(v) => setForm((f) => ({ ...f, flat_rate: v }))}
                    placeholder="e.g. 5,000"
                  />
                  <span className="st-hint">Amount in the worker&apos;s configured currency.</span>
                  {formErrors.flat_rate && <span className="st-error-text">{formErrors.flat_rate}</span>}
                </div>
              )}

              <div className="st-field">
                <label className="st-label" htmlFor="ot-threshold">
                  Threshold (hours/day)
                </label>
                <input
                  id="ot-threshold"
                  type="text"
                  inputMode="decimal"
                  className="st-input"
                  value={form.threshold_hours}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, "").replace(/^(\d*\.?\d*).*/, "$1");
                    setForm((f) => ({ ...f, threshold_hours: v }));
                  }}
                  placeholder="e.g. 8"
                />
                <span className="st-hint">Overtime kicks in after this many hours. Leave blank for no threshold.</span>
                {formErrors.threshold_hours && <span className="st-error-text">{formErrors.threshold_hours}</span>}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  id="ot-enabled"
                  type="checkbox"
                  checked={form.overtime_enabled}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, overtime_enabled: e.target.checked }))
                  }
                  style={{ width: 18, height: 18, cursor: "pointer", accentColor: "var(--st-accent)", flexShrink: 0 }}
                />
                <label htmlFor="ot-enabled" className="st-label" style={{ cursor: "pointer" }}>
                  Overtime enabled
                </label>
              </div>

              <div className="st-form__actions">
                <button
                  type="submit"
                  disabled={saving}
                  className="st-btn st-btn--primary st-btn--lg st-btn--block"
                >
                  {saving ? "Creating…" : "Create policy"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="st-btn st-btn--secondary st-btn--lg st-btn--block"
                >
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
