"use client";

import { useEffect, useState } from "react";
import { api, type UserSettings } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Toast, type ToastState } from "@/components/ds/Toast";
import { Select } from "@/components/ds/Select";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return <div className="st-section-head">{children}</div>;
}

function KvRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="st-kv">
      <span className="st-kv__k">{label}</span>
      <span className="st-kv__v">{value || "—"}</span>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const [notifEnabled, setNotifEnabled] = useState(true);
  const [reminderDays, setReminderDays] = useState("3");
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    api.settings
      .get()
      .then((res) => {
        const s = res.data;
        setSettings(s);
        if (s) {
          setNotifEnabled(s.enable_email_notifications);
          setReminderDays(String(s.reminder_days_before));
          setTheme(s.theme);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function handleSave(ev: React.FormEvent) {
    ev.preventDefault();
    const days = parseInt(reminderDays, 10);
    if (isNaN(days) || days < 1 || days > 30) {
      setToast({ type: "error", message: "Reminder days must be between 1 and 30" });
      return;
    }
    setSaving(true);
    api.settings
      .update({ theme, enable_email_notifications: notifEnabled, reminder_days_before: days })
      .then(() => {
        setToast({ type: "success", message: "Settings saved" });
        setSaving(false);
      })
      .catch((err: Error) => {
        setToast({ type: "error", message: err.message ?? "Failed to save" });
        setSaving(false);
      });
  }

  if (loading) {
    return (
      <>
        <header className="st-header ds-page-header">
          <div className="st-kicker-m">Account</div>
          <div className="st-skel" style={{ height: 28, width: "30%" }} />
        </header>
        <div className="ds-page-body">
          {[70, 50, 80, 60].map((w, i) => (
            <div key={i} className="st-skel" style={{ height: 14, marginBottom: 14, width: `${w}%` }} />
          ))}
        </div>
      </>
    );
  }

  const roleLabel = user?.role === "link" ? "Worker" : user?.role === "manager" ? "Manager" : (user?.role ?? "—");

  return (
    <>
      <header className="st-header ds-page-header">
        <div className="st-kicker-m">Account</div>
        <h1 className="st-screen-title">Settings</h1>
      </header>

      {toast && <Toast state={toast} onDismiss={() => setToast(null)} />}

      <div className="ds-page-body">
        {/* Profile — read-only */}
        <SectionHead>Profile</SectionHead>
        <KvRow label="Name" value={user ? `${user.first_name} ${user.last_name}` : "—"} />
        <KvRow label="Email" value={user?.email} />
        <KvRow label="Role" value={roleLabel} />
        <KvRow label="Member since" value={user?.created_at ? fmtDate(user.created_at) : "—"} />

        {/* Preferences */}
        <SectionHead>Preferences</SectionHead>
        <form onSubmit={handleSave} noValidate className="st-settings-form">
          <div className="st-field">
            <label className="st-label" htmlFor="theme">Theme</label>
            <Select
              id="theme"
              value={theme}
              onChange={setTheme}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "System default" },
              ]}
            />
          </div>

          <div className="st-field">
            <label className="st-label" htmlFor="reminder_days">
              Payment reminder (days before)
            </label>
            <input
              id="reminder_days"
              type="text"
              inputMode="numeric"
              className="st-input"
              value={reminderDays}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, "");
                setReminderDays(v);
              }}
            />
            <span className="st-hint">
              Get notified this many days before a payment is due.
            </span>
          </div>

          <div className="st-checkbox-row">
            <input
              id="email-notif"
              type="checkbox"
              className="st-checkbox"
              checked={notifEnabled}
              onChange={(e) => setNotifEnabled(e.target.checked)}
            />
            <label htmlFor="email-notif" className="st-checkbox-label">
              Enable email notifications
            </label>
          </div>

          <div style={{ paddingTop: 4 }}>
            <button type="submit" disabled={saving} className="st-btn st-btn--primary">
              {saving ? "Saving…" : "Save preferences"}
            </button>
          </div>
        </form>

        {/* Account info */}
        <SectionHead>Account</SectionHead>
        <KvRow label="Account type" value={roleLabel} />
        <KvRow label="Email verified" value="Yes" />

        {settings && (
          <>
            <KvRow label="Theme" value={settings.theme} />
            <KvRow
              label="Reminder"
              value={`${settings.reminder_days_before} day${settings.reminder_days_before !== 1 ? "s" : ""} before`}
            />
          </>
        )}
      </div>
    </>
  );
}
