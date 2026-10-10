"use client";

import { useEffect, useRef, useState } from "react";
import { api, type DeviceSummary, type RouterSummary } from "@/lib/api";
import { Select } from "@/components/ds/Select";
import { EmptyState } from "@/components/ds/EmptyState";

// ── Icon paths ───────────────────────────────────────────────────────────────
const IC_DEVICE = "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v11H3zM2 20h20";
const IC_ROUTER =
  "M2 15h20v6H2zM6 18h.01M10 18h.01M15 11V7M17.8 5.2a4 4 0 0 0-5.6 0";
const IC_PLUS = "M12 5v14M5 12h14";
const IC_CLOSE = "M18 6 6 18M6 6l12 12";
const IC_CHEVRON = "M9 18l6-6-6-6";

// ── Helpers ──────────────────────────────────────────────────────────────────
function statusClass(s: string) {
  const v = s.toLowerCase().replace(/ /g, "_");
  if (["active", "with_link"].includes(v)) return "st-tag st-tag--ok";
  if (["in_transit", "pending"].includes(v)) return "st-tag st-tag--pending";
  if (["offline", "inactive", "unassigned", "with_manager"].includes(v))
    return "st-tag st-tag--neutral";
  if (["lost", "failed"].includes(v)) return "st-tag st-tag--alert";
  return "st-tag st-tag--neutral";
}
function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Form types ───────────────────────────────────────────────────────────────
interface DeviceFields { name: string; deviceType: string; model: string; serial: string; }
interface RouterFields { name: string; routerType: string; routesTo: string; ipAddr: string; }

// ── Forms ────────────────────────────────────────────────────────────────────
function DeviceForm({ fields, onChange, nameRef }: {
  fields: DeviceFields;
  onChange: (f: Partial<DeviceFields>) => void;
  nameRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <>
      <div className="st-field">
        <label className="st-label" htmlFor="dev-name">Device name *</label>
        <input id="dev-name" ref={nameRef} className="st-input" type="text" value={fields.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. MacBook Air M1" required />
      </div>
      <div className="st-form__2col">
        <div className="st-field">
          <label className="st-label" htmlFor="dev-type">Type *</label>
          <Select id="dev-type" value={fields.deviceType}
            onChange={(v) => onChange({ deviceType: v })}
            options={[
              { value: "laptop", label: "Laptop" },
              { value: "cpu", label: "Desktop (CPU)" },
              { value: "phone", label: "Phone" },
              { value: "byod", label: "BYOD" },
            ]}
          />
        </div>
        <div className="st-field">
          <label className="st-label" htmlFor="dev-model">Model</label>
          <input id="dev-model" className="st-input" type="text" value={fields.model}
            onChange={(e) => onChange({ model: e.target.value })}
            placeholder="e.g. MacBook Air M1 2021" />
        </div>
      </div>
      <div className="st-field">
        <label className="st-label" htmlFor="dev-serial">Serial number</label>
        <input id="dev-serial" className="st-input" type="text" value={fields.serial}
          onChange={(e) => onChange({ serial: e.target.value })}
          placeholder="e.g. C02XYZ1234" />
      </div>
    </>
  );
}

function RouterForm({ fields, onChange, nameRef }: {
  fields: RouterFields;
  onChange: (f: Partial<RouterFields>) => void;
  nameRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <>
      <div className="st-field">
        <label className="st-label" htmlFor="rt-name">Router name *</label>
        <input id="rt-name" ref={nameRef} className="st-input" type="text" value={fields.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. Enugu-1" required />
      </div>
      <div className="st-field">
        <label className="st-label" htmlFor="rt-type">Router type *</label>
        <Select id="rt-type" value={fields.routerType}
          onChange={(v) => onChange({ routerType: v })}
          options={[
            { value: "flint", label: "Flint" },
            { value: "gli_net", label: "GL.iNet" },
            { value: "others", label: "Others" },
          ]}
        />
      </div>
      <div className="st-form__2col">
        <div className="st-field">
          <label className="st-label" htmlFor="rt-routes">Routes to *</label>
          <input id="rt-routes" className="st-input" type="text" value={fields.routesTo}
            onChange={(e) => onChange({ routesTo: e.target.value })}
            placeholder="e.g. Atlanta, GA" required />
        </div>
        <div className="st-field">
          <label className="st-label" htmlFor="rt-ip">IP address *</label>
          <input id="rt-ip" className="st-input" type="text" value={fields.ipAddr}
            onChange={(e) => onChange({ ipAddr: e.target.value })}
            placeholder="e.g. 192.168.1.1" required />
        </div>
      </div>
    </>
  );
}

// ── Register modal — desktop centered / mobile bottom sheet ───────────────────
function RegisterModal({ open, title, submitLabel, onClose, onSubmit, submitting, error, children }: {
  open: boolean; title: string; submitLabel: string;
  onClose: () => void; onSubmit: (e: React.FormEvent) => Promise<void>;
  submitting: boolean; error: string | null; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <div onClick={() => { if (!submitting) onClose(); }} aria-hidden="true" className="st-scrim-overlay" />
      <div role="dialog" aria-modal="true" aria-label={title} className="register-modal">
        <div className="sheet-handle" />
        <div className="register-modal__bar">
          <span className="register-modal__title">{title}</span>
          <button type="button" onClick={() => { if (!submitting) onClose(); }} aria-label="Close" className="register-modal__close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
              <path d={IC_CLOSE} />
            </svg>
          </button>
        </div>
        <form onSubmit={onSubmit} className="register-modal__body">
          {error && <div className="st-banner">{error}</div>}
          {children}
          <div className="register-modal__actions">
            <button type="button" className="st-btn st-btn--secondary st-btn--lg"
              onClick={() => { if (!submitting) onClose(); }} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="st-btn st-btn--primary st-btn--lg" disabled={submitting}>
              {submitting ? "Registering…" : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ── Skeletons ─────────────────────────────────────────────────────────────────
function MobileSkeleton() {
  return (
    <div className="asset-row">
      <div className="st-iconbox st-skel" />
      <div className="asset-row__body">
        <div className="st-skel" style={{ height: 12, width: "55%" }} />
        <div className="st-skel" style={{ height: 10, width: "38%", marginTop: 4 }} />
      </div>
      <div className="st-skel" style={{ width: 56, height: 20 }} />
    </div>
  );
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j}>
              <div className="st-skel" style={{ height: 13, width: j === 0 ? "70%" : "55%" }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Mobile list rows ──────────────────────────────────────────────────────────
function DeviceRow({ d }: { d: DeviceSummary }) {
  return (
    <div className="asset-row">
      <div className="st-iconbox">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={IC_DEVICE} />
        </svg>
      </div>
      <div className="asset-row__body">
        <div className="asset-row__name">{d.name}</div>
        <div className="asset-row__meta">
          {[d.serial_number, d.current_link_name ?? "Unassigned"].filter(Boolean).join(" · ")}
        </div>
      </div>
      <span className={`${statusClass(d.status)} asset-row__tag`}>{statusLabel(d.status)}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" className="asset-row__chevron" aria-hidden="true">
        <path d={IC_CHEVRON} />
      </svg>
    </div>
  );
}

function RouterRow({ r }: { r: RouterSummary }) {
  return (
    <div className="asset-row">
      <div className="st-iconbox">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={IC_ROUTER} />
        </svg>
      </div>
      <div className="asset-row__body">
        <div className="asset-row__name">{r.name}</div>
        <div className="asset-row__meta">{r.router_type} · routes to {r.routes_to}</div>
      </div>
      <span className={`${statusClass(r.status)} asset-row__tag`}>{statusLabel(r.status)}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" className="asset-row__chevron" aria-hidden="true">
        <path d={IC_CHEVRON} />
      </svg>
    </div>
  );
}

// ── KPI stat bar ──────────────────────────────────────────────────────────────
function DeviceKpi({ devices }: { devices: DeviceSummary[] }) {
  const total = devices.length;
  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;
  const withManager = devices.filter((d) => d.status === "with_manager").length;
  const inTransit   = devices.filter((d) => d.status === "in_transit").length;
  const withLink    = devices.filter((d) => d.status === "with_link").length;
  const stats = [
    { label: "Total devices", value: total,       pct: 100 },
    { label: "With Manager",  value: withManager, pct: pct(withManager) },
    { label: "In Transit",    value: inTransit,   pct: pct(inTransit) },
    { label: "With Link",     value: withLink,    pct: pct(withLink) },
  ];
  return (
    <div className="assets-kpi">
      {stats.map((s) => (
        <div key={s.label} className="assets-kpi__cell">
          <div className="assets-kpi__label">{s.label}</div>
          <div className="assets-kpi__value">{s.value}</div>
          <div className="assets-kpi__bar">
            <div className="assets-kpi__fill" style={{ width: `${s.pct}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Table headers ─────────────────────────────────────────────────────────────
const DEVICE_HEADERS  = ["Device", "Type", "Model", "Serial", "Status", "Current holder"];
const ROUTER_HEADERS  = ["Router", "Type", "Routes to", "IP address", "Status", "Current holder"];

type Tab = "devices" | "routers";

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AssetsPage() {
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [routers, setRouters] = useState<RouterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("devices");

  const [deviceOpen, setDeviceOpen] = useState(false);
  const [deviceFields, setDeviceFields] = useState<DeviceFields>({ name: "", deviceType: "laptop", model: "", serial: "" });
  const [deviceSubmitting, setDeviceSubmitting] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const deviceNameRef = useRef<HTMLInputElement>(null);

  const [routerOpen, setRouterOpen] = useState(false);
  const [routerFields, setRouterFields] = useState<RouterFields>({ name: "", routerType: "flint", routesTo: "", ipAddr: "" });
  const [routerSubmitting, setRouterSubmitting] = useState(false);
  const [routerError, setRouterError] = useState<string | null>(null);
  const routerNameRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [devRes, rtRes] = await Promise.all([api.manager.devices(), api.manager.routers()]);
      setDevices(devRes.data ?? []);
      setRouters(rtRes.data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load assets");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (deviceOpen) {
      setDeviceFields({ name: "", deviceType: "laptop", model: "", serial: "" });
      setDeviceError(null);
      setTimeout(() => deviceNameRef.current?.focus(), 60);
    }
  }, [deviceOpen]);

  useEffect(() => {
    if (routerOpen) {
      setRouterFields({ name: "", routerType: "flint", routesTo: "", ipAddr: "" });
      setRouterError(null);
      setTimeout(() => routerNameRef.current?.focus(), 60);
    }
  }, [routerOpen]);

  async function submitDevice(e: React.FormEvent) {
    e.preventDefault();
    if (!deviceFields.name.trim()) { setDeviceError("Device name is required."); return; }
    setDeviceSubmitting(true); setDeviceError(null);
    try {
      await api.manager.createDevice({
        name: deviceFields.name.trim(),
        device_type: deviceFields.deviceType,
        model: deviceFields.model.trim() || undefined,
        serial_number: deviceFields.serial.trim() || undefined,
      });
      await load(); setDeviceOpen(false);
    } catch (err: unknown) {
      setDeviceError(err instanceof Error ? err.message : "Failed to register device.");
    } finally { setDeviceSubmitting(false); }
  }

  async function submitRouter(e: React.FormEvent) {
    e.preventDefault();
    if (!routerFields.name.trim()) { setRouterError("Router name is required."); return; }
    if (!routerFields.routesTo.trim()) { setRouterError("Routes-to location is required."); return; }
    if (!routerFields.ipAddr.trim()) { setRouterError("IP address is required."); return; }
    setRouterSubmitting(true); setRouterError(null);
    try {
      await api.manager.createRouter({
        name: routerFields.name.trim(),
        router_type: routerFields.routerType,
        routes_to: routerFields.routesTo.trim(),
        ip_addr: routerFields.ipAddr.trim(),
      });
      await load(); setRouterOpen(false);
    } catch (err: unknown) {
      setRouterError(err instanceof Error ? err.message : "Failed to register router.");
    } finally { setRouterSubmitting(false); }
  }

  const openRegister = () => {
    if (tab === "devices") setDeviceOpen(true);
    else setRouterOpen(true);
  };

  const errorBanner = error && (
    <div className="st-banner">
      <span className="st-small">{error}</span>
      <button type="button" onClick={load} className="st-btn st-btn--secondary" style={{ marginLeft: "auto", fontSize: 12 }}>
        Try again
      </button>
    </div>
  );

  return (
    <>
      {/* ══ DESKTOP (≥900px) ══════════════════════════════════════════════════ */}
      <div className="assets-desktop">
        <div className="assets-desktop-hdr">
          <div className="assets-desktop-hdr__kicker">Manager</div>
          <div className="assets-desktop-hdr__row">
            <h1 className="assets-desktop-hdr__title">Assets</h1>
            <div className="assets-desktop-hdr__tabs">
              {(["devices", "routers"] as Tab[]).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)}
                  className={`assets-tab${tab === t ? " assets-tab--active" : ""}`}>
                  {t === "devices" ? "Devices" : "Routers"}
                  {!loading && (
                    <span className="st-meta" style={{ marginLeft: 6, fontWeight: 400, opacity: 0.65 }}>
                      · {t === "devices" ? devices.length : routers.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="assets-desktop-hdr__actions">
              <button type="button" className="st-btn st-btn--primary" onClick={openRegister}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" aria-hidden="true">
                  <path d={IC_PLUS} />
                </svg>
                {tab === "devices" ? "Register device" : "Register router"}
              </button>
            </div>
          </div>
        </div>

        {errorBanner}

        {/* Devices tab */}
        {tab === "devices" && (
          <>
            {!loading && devices.length > 0 && <DeviceKpi devices={devices} />}
            <div className="assets-table-body">
              {loading ? (
                <table className="assets-table">
                  <thead><tr>{DEVICE_HEADERS.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody><TableSkeleton cols={6} /></tbody>
                </table>
              ) : devices.length === 0 ? (
                <EmptyState icon="device" title="No devices yet"
                  description="Register the laptops and phones you own so you always know who is holding what."
                  action={{ label: "Register device", onClick: () => setDeviceOpen(true) }} />
              ) : (
                <table className="assets-table">
                  <thead><tr>{DEVICE_HEADERS.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {devices.map((d) => (
                      <tr key={d.id} className="assets-table-row">
                        <td className="assets-table__name">{d.name}</td>
                        <td>{d.device_type}</td>
                        <td className="st-meta">{d.model ?? "—"}</td>
                        <td className="st-num st-meta">{d.serial_number ?? "—"}</td>
                        <td><span className={statusClass(d.status)}>{statusLabel(d.status)}</span></td>
                        <td className="st-meta">{d.current_link_name ?? "Unassigned"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* Routers tab */}
        {tab === "routers" && (
          <div className="assets-table-body">
            {loading ? (
              <table className="assets-table">
                <thead><tr>{ROUTER_HEADERS.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody><TableSkeleton cols={6} /></tbody>
              </table>
            ) : routers.length === 0 ? (
              <EmptyState icon="router" title="No routers yet"
                description="Register your routers so you can ship them to workers and track custody from here."
                action={{ label: "Register router", onClick: () => setRouterOpen(true) }} />
            ) : (
              <table className="assets-table">
                <thead><tr>{ROUTER_HEADERS.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {routers.map((r) => (
                    <tr key={r.id} className="assets-table-row">
                      <td className="assets-table__name">{r.name}</td>
                      <td>{r.router_type}</td>
                      <td className="st-meta">{r.routes_to}</td>
                      <td className="st-num st-meta">{r.ip_addr}</td>
                      <td><span className={statusClass(r.status)}>{statusLabel(r.status)}</span></td>
                      <td className="st-meta">{r.current_link_name ?? "Unassigned"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ══ MOBILE (<900px) ═══════════════════════════════════════════════════ */}
      <div className="assets-mobile">
        <div className="assets-mobile-hdr">
          <h1 className="assets-mobile-hdr__title">Assets</h1>
          <button type="button" onClick={openRegister}
            aria-label={tab === "devices" ? "Register device" : "Register router"}
            className="assets-mobile-hdr__add">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
              <path d={IC_PLUS} />
            </svg>
          </button>
        </div>

        <div className="assets-mobile-tabs">
          {(["devices", "routers"] as Tab[]).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`assets-mobile-tab${tab === t ? " assets-mobile-tab--active" : ""}`}>
              {t === "devices" ? "Devices" : "Routers"}
              {!loading && <span className="st-meta" style={{ marginLeft: 5, fontWeight: 400 }}>· {t === "devices" ? devices.length : routers.length}</span>}
            </button>
          ))}
        </div>

        {errorBanner}

        <div className="assets-mobile-body">
          {loading ? (
            <div style={{ marginTop: 4 }}>
              {Array.from({ length: 5 }).map((_, i) => <MobileSkeleton key={i} />)}
            </div>
          ) : tab === "devices" ? (
            devices.length === 0 ? (
              <EmptyState icon="device" title="No devices yet"
                description="Register the laptops and phones you own so you always know who is holding what."
                action={{ label: "Register first device", onClick: () => setDeviceOpen(true) }} />
            ) : (
              <div style={{ marginTop: 4 }}>
                {devices.map((d) => <DeviceRow key={d.id} d={d} />)}
              </div>
            )
          ) : (
            routers.length === 0 ? (
              <EmptyState icon="router" title="No routers yet"
                description="Register your routers so you can ship them to workers and track custody from here."
                action={{ label: "Register first router", onClick: () => setRouterOpen(true) }} />
            ) : (
              <div style={{ marginTop: 4 }}>
                {routers.map((r) => <RouterRow key={r.id} r={r} />)}
              </div>
            )
          )}
        </div>
      </div>

      {/* ══ MODALS ════════════════════════════════════════════════════════════ */}
      <RegisterModal
        open={deviceOpen} title="Register a device" submitLabel="Register device"
        onClose={() => setDeviceOpen(false)} onSubmit={submitDevice}
        submitting={deviceSubmitting} error={deviceError}>
        <DeviceForm fields={deviceFields}
          onChange={(f) => setDeviceFields((p) => ({ ...p, ...f }))}
          nameRef={deviceNameRef} />
      </RegisterModal>
      <RegisterModal
        open={routerOpen} title="Register a router" submitLabel="Register router"
        onClose={() => setRouterOpen(false)} onSubmit={submitRouter}
        submitting={routerSubmitting} error={routerError}>
        <RouterForm fields={routerFields}
          onChange={(f) => setRouterFields((p) => ({ ...p, ...f }))}
          nameRef={routerNameRef} />
      </RegisterModal>
    </>
  );
}
