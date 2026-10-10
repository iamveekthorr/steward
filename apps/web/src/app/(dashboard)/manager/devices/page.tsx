"use client";

import { useEffect, useState } from "react";
import { api, type DeviceSummary } from "@/lib/api";
import { PageHeader } from "@/components/ds/PageHeader";
import { DataTable } from "@/components/ds/DataTable";
import { StatusBadge } from "@/components/ds/StatusBadge";
import { Toast, type ToastState } from "@/components/ds/Toast";
import { Select } from "@/components/ds/Select";

const HEADERS = ["Device", "Type", "Model", "Serial", "Status", "Assigned to"];

const DEVICE_TYPES = [
  { value: "laptop", label: "Laptop" },
  { value: "cpu", label: "Desktop / CPU" },
  { value: "phone", label: "Phone" },
  { value: "byod", label: "BYOD" },
];

interface RegisterForm {
  name: string;
  device_type: string;
  model: string;
  serial_number: string;
}

const EMPTY_FORM: RegisterForm = { name: "", device_type: "laptop", model: "", serial_number: "" };

export default function DevicesPage() {
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<RegisterForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  function load() {
    if (!navigator.onLine) {
      setError("No internet connection. Check your network and try again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api.manager
      .devices()
      .then((res) => {
        setDevices(res.data ?? []);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message ?? "Failed to load devices");
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
    window.addEventListener("online", load);
    return () => window.removeEventListener("online", load);
  }, []);

  function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) {
      setFormError("Device name is required");
      return;
    }
    setSaving(true);
    api.manager
      .createDevice({
        name: form.name.trim(),
        device_type: form.device_type,
        model: form.model.trim() || undefined,
        serial_number: form.serial_number.trim() || undefined,
      })
      .then(() => {
        setSaving(false);
        setShowModal(false);
        setForm(EMPTY_FORM);
        setToast({ type: "success", message: "Device registered" });
        load();
      })
      .catch((err: Error) => {
        setSaving(false);
        setToast({ type: "error", message: err.message ?? "Failed to register device" });
      });
  }

  return (
    <>
      <PageHeader
        role="Manager"
        title="Devices"
        actions={
          <button
            type="button"
            className="st-btn st-btn--primary"
            onClick={() => {
              setForm(EMPTY_FORM);
              setFormError(null);
              setShowModal(true);
            }}
          >
            Register device
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
          hasData={devices.length > 0}
          empty={{
            icon: "device",
            title: "No devices yet",
            description:
              "Register the laptops and phones you own so you always know who is holding what.",
          }}
        >
          {devices.map((d) => (
            <tr key={d.id}>
              <td style={{ fontWeight: 800 }}>{d.name}</td>
              <td>{d.device_type}</td>
              <td className="st-meta">{d.model ?? "—"}</td>
              <td className="st-num st-meta">{d.serial_number ?? "—"}</td>
              <td><StatusBadge status={d.status} /></td>
              <td className="st-meta">{d.current_link_name ?? "Unassigned"}</td>
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
            className="dev-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Register device"
          >
            <div className="dev-handle" />
            <div className="st-dialog__hdr">
              <h2 className="st-dialog__title">Register device</h2>
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
              {formError && <div className="st-banner">{formError}</div>}

              <div className="st-field">
                <label className="st-label" htmlFor="dev-name">Device name *</label>
                <input
                  id="dev-name"
                  type="text"
                  className="st-input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Victor's MacBook Pro"
                />
              </div>

              <div className="st-field">
                <label className="st-label" htmlFor="dev-type">Device type *</label>
                <Select
                  id="dev-type"
                  value={form.device_type}
                  onChange={(v) => setForm((f) => ({ ...f, device_type: v }))}
                  options={DEVICE_TYPES}
                />
              </div>

              <div className="st-field">
                <label className="st-label" htmlFor="dev-model">
                  Model <span style={{ fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  id="dev-model"
                  type="text"
                  className="st-input"
                  value={form.model}
                  onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                  placeholder="e.g. MacBook Pro M3"
                />
              </div>

              <div className="st-field">
                <label className="st-label" htmlFor="dev-serial">
                  Serial number <span style={{ fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  id="dev-serial"
                  type="text"
                  className="st-input"
                  value={form.serial_number}
                  onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))}
                  placeholder="e.g. C02X1234ABCD"
                />
              </div>

              <div className="st-form__actions">
                <button type="submit" disabled={saving} className="st-btn st-btn--primary st-btn--lg st-btn--block">
                  {saving ? "Registering…" : "Register device"}
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
