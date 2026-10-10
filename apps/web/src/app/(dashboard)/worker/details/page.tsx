"use client";

import { useEffect, useRef, useState } from "react";
import { api, type WorkerDetails, type UpdateBankRequest } from "@/lib/api";
import { Toast, type ToastState } from "@/components/ds/Toast";
import { Select } from "@/components/ds/Select";

const IC_CLOSE = "M18 6 6 18M6 6l12 12";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtAmount(minor: number | null, currency: string | null) {
  if (!minor || !currency) return "—";
  return `${currency.toUpperCase()} ${(minor / 100).toLocaleString("en-NG")}`;
}

function maskAccount(n: string | null) {
  if (!n) return "—";
  return `••• ${n.slice(-4)}`;
}

function KvRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="st-kv">
      <span className="st-kv__k">{label}</span>
      <span className="st-kv__v">{value || "—"}</span>
    </div>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--st-neutral-700)",
        paddingBottom: 6,
        borderBottom: "2px solid var(--st-text)",
        marginBottom: 0,
        marginTop: 24,
      }}
    >
      {children}
    </div>
  );
}

export default function WorkerDetailsPage() {
  const [details, setDetails] = useState<WorkerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const firstRef = useRef<HTMLSelectElement | null>(null);

  const [form, setForm] = useState<UpdateBankRequest>({
    payment_method: "",
    bank_name: "",
    bank_account_number: "",
    preferred_currency: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof UpdateBankRequest, string>>>({});

  useEffect(() => {
    api.worker
      .details()
      .then((res) => {
        const d = res.data;
        setDetails(d);
        if (d) {
          setForm({
            payment_method: d.payment_method ?? "",
            bank_name: d.bank_name ?? "",
            bank_account_number: d.bank_account_number ?? "",
            preferred_currency: d.preferred_currency ?? "",
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (editOpen) {
      setTimeout(() => firstRef.current?.focus(), 60);
    }
  }, [editOpen]);

  function validate() {
    const e: Partial<Record<keyof UpdateBankRequest, string>> = {};
    if (!form.payment_method) e.payment_method = "Payment method is required";
    if (!form.preferred_currency) e.preferred_currency = "Preferred currency is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    api.worker
      .updateBank(form)
      .then(() => {
        setDetails((d) => d ? { ...d, ...form } : d);
        setToast({ type: "success", message: "Payment details updated" });
        setSaving(false);
        setEditOpen(false);
      })
      .catch((err: Error) => {
        setToast({ type: "error", message: err.message ?? "Failed to save" });
        setSaving(false);
      });
  }

  if (loading) {
    return (
      <>
        <header style={{ padding: "22px 28px 18px", borderBottom: "2px solid var(--st-divider)" }}>
          <div className="st-kicker-m" style={{ marginBottom: 4 }}>Worker</div>
          <div className="st-skel" style={{ height: 28, width: "40%" }} />
        </header>
        <div style={{ padding: "20px 28px" }}>
          {[80, 60, 70, 50, 65].map((w, i) => (
            <div key={i} className="st-skel" style={{ height: 14, marginBottom: 14, width: `${w}%` }} />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <header style={{ padding: "22px 28px 18px", borderBottom: "2px solid var(--st-divider)" }}>
        <div className="st-kicker-m" style={{ marginBottom: 4 }}>Worker</div>
        <h1 className="st-screen-title">My details</h1>
      </header>

      {toast && <Toast state={toast} onDismiss={() => setToast(null)} />}

      <div style={{ padding: "20px 28px 40px" }}>
        {/* Where you get paid card */}
        <div
          style={{
            border: "2px solid var(--st-text)",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span
              style={{
                fontSize: 11,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--st-accent-700)",
                fontWeight: 700,
              }}
            >
              Where you get paid
            </span>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              style={{
                fontSize: 14,
                color: "var(--st-accent-700)",
                fontWeight: 600,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "0 4px",
                fontFamily: "inherit",
              }}
            >
              Edit
            </button>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>
            {details?.bank_name || "—"}
          </div>
          <div style={{ fontSize: 13, color: "var(--st-neutral-700)" }}>
            {maskAccount(details?.bank_account_number ?? null)}
            {details?.preferred_currency ? ` · ${details.preferred_currency.toUpperCase()}` : ""}
          </div>
        </div>

        {/* Employment */}
        <SectionHead>Employment</SectionHead>
        <KvRow label="Job type" value={details?.job_type} />
        <KvRow
          label="Start date"
          value={details?.start_date ? fmtDate(details.start_date) : null}
        />
        <KvRow label="Manager" value={details?.manager_name} />
        <KvRow label="Pay schedule" value={details?.pay_schedule} />
        <KvRow
          label="Base pay"
          value={fmtAmount(details?.base_amount ?? null, details?.currency ?? null)}
        />

        {/* Location */}
        <SectionHead>Location</SectionHead>
        <KvRow label="Home country" value={details?.home_country} />
        <KvRow label="Home city" value={details?.home_city} />
        <KvRow label="Work country" value={details?.work_country} />
        <KvRow label="Work city" value={details?.work_city} />
      </div>

      {/* Edit bank details sheet / dialog */}
      {editOpen && (
        <div
          className="st-scrim"
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditOpen(false); }}
        >
          <style>{`
            @media (min-width: 900px) {
              .edit-sheet {
                max-width: 560px !important;
                border-radius: 0 !important;
                padding: 16px !important;
                gap: 12px !important;
                margin: auto !important;
                position: relative !important;
                box-shadow: var(--st-shadow-lg) !important;
                background: var(--st-surface) !important;
                align-self: center !important;
              }
              .edit-sheet .sheet-handle { display: none !important; }
              .edit-sheet .sheet-actions .st-btn { min-height: 36px !important; width: auto !important; }
            }
          `}</style>
          <div
            className="edit-sheet"
            style={{
              background: "var(--st-bg)",
              width: "100%",
              padding: "10px 20px calc(30px + env(safe-area-inset-bottom))",
              display: "flex",
              flexDirection: "column",
              gap: 14,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Edit payment details"
          >
            <div className="sheet-handle" style={{ width: 40, height: 4, background: "var(--st-divider)", borderRadius: 2, alignSelf: "center", marginBottom: 4 }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Payment details</h2>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                aria-label="Close"
                style={{ width: 44, height: 44, background: "none", border: "none", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--st-text)" }}
              >
                <svg width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d={IC_CLOSE} /></svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="st-field">
                <label className="st-label" htmlFor="pm">Payment method *</label>
                <Select
                  id="pm"
                  value={form.payment_method}
                  onChange={(v) => setForm((f) => ({ ...f, payment_method: v }))}
                  invalid={!!errors.payment_method}
                  options={[
                    { value: "", label: "Select…" },
                    { value: "bank_transfer", label: "Bank transfer" },
                    { value: "crypto", label: "Crypto" },
                    { value: "mobile_money", label: "Mobile money" },
                    { value: "paypal", label: "PayPal" },
                  ]}
                />
                {errors.payment_method && <span className="st-error-text">{errors.payment_method}</span>}
              </div>

              <div className="st-field">
                <label className="st-label" htmlFor="bn">Bank name</label>
                <input
                  id="bn"
                  type="text"
                  className="st-input"
                  value={form.bank_name ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}
                  placeholder="e.g. Zenith Bank"
                />
              </div>

              <div className="st-field">
                <label className="st-label" htmlFor="ba">Account number</label>
                <input
                  id="ba"
                  type="text"
                  inputMode="numeric"
                  className="st-input"
                  value={form.bank_account_number ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, bank_account_number: e.target.value }))}
                  placeholder="10-digit account number"
                />
              </div>

              <div className="st-field">
                <label className="st-label" htmlFor="pc">Preferred currency *</label>
                <Select
                  id="pc"
                  value={form.preferred_currency}
                  onChange={(v) => setForm((f) => ({ ...f, preferred_currency: v }))}
                  invalid={!!errors.preferred_currency}
                  options={[
                    { value: "", label: "Select…" },
                    { value: "ngn", label: "NGN — Nigerian Naira" },
                    { value: "usd", label: "USD — US Dollar" },
                    { value: "gbp", label: "GBP — British Pound" },
                    { value: "eur", label: "EUR — Euro" },
                    { value: "cad", label: "CAD — Canadian Dollar" },
                  ]}
                />
                {errors.preferred_currency && <span className="st-error-text">{errors.preferred_currency}</span>}
              </div>

              <div className="sheet-actions" style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                <button type="submit" disabled={saving} className="st-btn st-btn--primary st-btn--lg st-btn--block">
                  {saving ? "Saving…" : "Save payment details"}
                </button>
                <button type="button" onClick={() => setEditOpen(false)} className="st-btn st-btn--secondary st-btn--lg st-btn--block">
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
