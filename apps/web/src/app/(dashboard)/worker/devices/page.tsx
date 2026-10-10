"use client";

import { useWorkerAssets } from "@/lib/hooks/useManagerDashboard";

function statusClass(s: string) {
  const v = s.toLowerCase();
  if (["active", "with_link"].includes(v)) return "st-tag st-tag--ok";
  if (["in_transit", "pending"].includes(v)) return "st-tag st-tag--pending";
  if (["lost", "failed", "damaged"].includes(v)) return "st-tag st-tag--alert";
  return "st-tag st-tag--neutral";
}

export default function WorkerDevicesPage() {
  const { data: assets, isLoading: loading, error: swrError, mutate } = useWorkerAssets();
  const error = swrError ? (swrError instanceof Error ? swrError.message : "Failed to load devices") : null;
  const devices = assets?.devices ?? [];

  return (
    <>
      <header style={{ padding: "22px 28px 18px", borderBottom: "2px solid var(--st-divider)" }}>
        <div className="st-kicker-m" style={{ marginBottom: 4 }}>Worker</div>
        <h1 className="st-screen-title">Devices</h1>
      </header>

      <div style={{ padding: "4px 28px 40px" }}>
        {error && (
          <div style={{ padding: "20px 0" }}>
            <p style={{ fontSize: 14, color: "var(--st-alert-700)", marginBottom: 12 }}>{error}</p>
            <button type="button" onClick={() => mutate()} className="st-btn st-btn--secondary">
              Retry
            </button>
          </div>
        )}

        {!error && (
          <div style={{ marginBottom: 32 }}>
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
              Devices
            </div>

            {loading ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {[1, 2].map((i) => (
                  <div key={i} className="st-row">
                    <div className="st-skel" style={{ width: 40, height: 40, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div className="st-skel" style={{ height: 14, width: "40%", marginBottom: 6 }} />
                      <div className="st-skel" style={{ height: 12, width: "25%" }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : devices.length === 0 ? (
              <div style={{ textAlign: "center", padding: "36px 0" }}>
                <div
                  className="st-iconbox"
                  style={{ margin: "0 auto 16px", width: 40, height: 40, display: "grid", placeItems: "center" }}
                >
                  <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <path d="M8 21h8M12 17v4" />
                  </svg>
                </div>
                <p style={{ fontWeight: 800, fontSize: 15, margin: "0 0 6px" }}>Nothing in your care</p>
                <p style={{ fontSize: 14, color: "var(--st-neutral-700)", margin: "0 auto", maxWidth: 400 }}>
                  Your manager has not shipped you a device. If one arrives, it will be listed here.
                </p>
              </div>
            ) : (
              <div>
                {devices.map((d) => (
                  <div key={d.id} className="st-row">
                    <div className="st-row__main">
                      <div style={{ fontWeight: 800, fontSize: 15 }}>{d.name}</div>
                      <div style={{ fontSize: 13, color: "var(--st-neutral-700)" }}>
                        {d.asset_type}
                        {d.model ? ` · ${d.model}` : ""}
                        {d.serial_number ? ` · ${d.serial_number}` : ""}
                      </div>
                    </div>
                    <div className="st-row__end" style={{ flexShrink: 0 }}>
                      <span className={statusClass(d.status)}>{d.status.replace(/_/g, " ")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
