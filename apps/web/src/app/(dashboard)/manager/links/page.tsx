"use client";

import { useEffect, useState } from "react";
import { api, type LinkQuotaStatus, type LinkSummary } from "@/lib/api";
import { EmptyState } from "@/components/ds/EmptyState";
import { useAuth } from "@/lib/auth";
import { DatePicker } from "@/components/ds/DatePicker";

type FilterTab = "All" | "Active" | "Pending" | "Overdue" | "Inactive" | "Suspended";

function fmtMoney(minor: number | null, currency: string | null) {
  if (minor == null || currency == null) return "—";
  return `${currency} ${(minor / 100).toLocaleString("en-NG")}`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function mapStatus(status: string): "Active" | "Pending" | "Overdue" | "Inactive" | "Suspended" {
  const s = status.toLowerCase();
  if (s === "active") return "Active";
  if (s === "overdue") return "Overdue";
  if (s === "pending") return "Pending";
  if (s === "suspended") return "Suspended";
  if (s === "terminated" || s === "inactive") return "Inactive";
  return "Active";
}

function statusTagClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "overdue") return "st-tag st-tag--alert";
  if (s === "active") return "st-tag st-tag--ok";
  return "st-tag st-tag--neutral";
}

function statusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === "terminated") return "Inactive";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function dueDateColor(status: string): string {
  return status.toLowerCase() === "overdue" ? "var(--st-alert-700)" : "var(--st-text)";
}

const headers = ["Name", "Job type", "Schedule", "Amount", "Next due", "Last paid", "Status", ""];
const filterTabs: FilterTab[] = ["All", "Active", "Pending", "Overdue", "Inactive", "Suspended"];

interface AddLinkModalProps {
  onClose: () => void;
  onAdded: () => void;
  managerName: string;
}

function AddLinkModal({ onClose, onAdded, managerName }: AddLinkModalProps) {
  const [workerEmail, setWorkerEmail] = useState("");
  const [jobType, setJobType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [homeCountry, setHomeCountry] = useState("");
  const [workCountry, setWorkCountry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.manager.createLink({
        worker_email: workerEmail,
        job_type: jobType,
        start_date: new Date(startDate).toISOString(),
        home_country: homeCountry,
        work_country: workCountry,
      });
      // Fire invite email — best-effort, don't block success
      fetch("/api/email/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: workerEmail, managerName }),
      }).catch(() => {});
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="st-scrim st-scrim--sheet"
      style={{ zIndex: 100 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="add-link-sheet" role="dialog" aria-modal="true" aria-label="Add worker link">
        <div className="add-link-handle" />
        <div className="st-dialog__hdr">
          <h2 className="st-dialog__title">Add link (worker)</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="st-iconbtn">
            <svg width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="st-small st-meta">
          Enter the worker&apos;s email address to link them to your account.
        </p>

        <form onSubmit={handleSubmit} className="st-form">
          <div className="st-field">
            <label htmlFor="worker-email" className="st-label">Worker email</label>
            <input
              id="worker-email"
              type="email"
              required
              className="st-input"
              value={workerEmail}
              onChange={(e) => setWorkerEmail(e.target.value)}
              placeholder="worker@example.com"
            />
          </div>
          <div className="st-field">
            <label htmlFor="job-type" className="st-label">Job type</label>
            <input
              id="job-type"
              required
              className="st-input"
              value={jobType}
              onChange={(e) => setJobType(e.target.value)}
              placeholder="e.g. House assistant, Driver"
            />
          </div>
          <div className="add-link-2col">
            <div className="st-field">
              <label htmlFor="home-country" className="st-label">Home country</label>
              <input
                id="home-country"
                required
                className="st-input"
                value={homeCountry}
                onChange={(e) => setHomeCountry(e.target.value)}
                placeholder="Nigeria"
              />
            </div>
            <div className="st-field">
              <label htmlFor="work-country" className="st-label">Work country</label>
              <input
                id="work-country"
                required
                className="st-input"
                value={workCountry}
                onChange={(e) => setWorkCountry(e.target.value)}
                placeholder="Nigeria"
              />
            </div>
          </div>
          <div className="st-field">
            <label htmlFor="start-date" className="st-label">Start date</label>
            <DatePicker id="start-date" value={startDate} onChange={setStartDate} />
          </div>

          {error && <div className="st-banner">{error}</div>}

          <div className="st-form__actions">
            <button type="submit" disabled={loading} className="st-btn st-btn--primary st-btn--lg st-btn--block">
              {loading ? "Sending…" : "Send invite"}
            </button>
            <button type="button" onClick={onClose} className="st-btn st-btn--secondary st-btn--lg st-btn--block">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LinksPage() {
  const { user } = useAuth();
  const managerName = user ? `${user.first_name} ${user.last_name}` : "Your manager";
  const [filter, setFilter] = useState<FilterTab>("All");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [quota, setQuota] = useState<LinkQuotaStatus | null>(null);
  const [links, setLinks] = useState<LinkSummary[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);
  const [linksError, setLinksError] = useState<string | null>(null);

  function loadLinks() {
    setLinksLoading(true);
    setLinksError(null);
    api.manager
      .links()
      .then((res) => { setLinks(res.data ?? []); setLinksLoading(false); })
      .catch((err: Error) => { setLinksError(err.message ?? "Failed to load links"); setLinksLoading(false); });
  }

  useEffect(() => {
    loadLinks();
    api.manager.quota().then((res) => { if (res.data) setQuota(res.data); }).catch(() => {});
  }, []);

  const filtered = links.filter((l) => {
    const displayStatus = mapStatus(l.status);
    return l.worker_name.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "All" || displayStatus === filter);
  });

  const atQuota = quota ? !quota.can_add_links : false;

  return (
    <>
      <header className="st-header ds-page-header">
        <div>
          <div className="st-kicker-m">Manager</div>
          <h1 className="st-screen-title">Links</h1>
          {quota && !atQuota && (
            <p className="st-meta lnk-quota-note">
              {quota.link_count} / 5 links used
              {quota.quota_approved && " · Quota approved"}
            </p>
          )}
        </div>

        <div className="lnk-header-actions">
          <button
            type="button"
            disabled={atQuota}
            onClick={() => !atQuota && setShowModal(true)}
            className="st-btn st-btn--primary"
            style={{ opacity: atQuota ? 0.5 : 1, cursor: atQuota ? "not-allowed" : "pointer" }}
          >
            + Add link
          </button>
          {atQuota && (
            <p className="st-meta lnk-quota-err">
              Quota of {quota?.link_count} reached. Contact support to add more.
            </p>
          )}
        </div>
      </header>

      {atQuota && (
        <div className="st-callout lnk-callout-offset">
          <strong>Link quota reached.</strong> You have reached the free tier limit of 5 links.
          Please contact support to request an increase before adding more workers.
        </div>
      )}

      <div className="links-filter-bar">
        <input
          placeholder="Search by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="st-input lnk-search-input"
        />
        <div className="links-tabs-scroll">
          {filterTabs.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`links-tab${filter === f ? " links-tab--active" : ""}`}
            >
              {f}
            </button>
          ))}
        </div>
        <span className="st-meta lnk-count-label">
          {filtered.length} {filtered.length === 1 ? "link" : "links"}
        </span>
      </div>

      <div className="ds-page-body">
        {linksLoading && (
          <div className="lnk-table-loading">
            {[1, 2, 3].map((i) => (
              <div key={i} className="st-skel" style={{ height: 44, marginBottom: 8, width: "100%" }} />
            ))}
          </div>
        )}
        {!linksLoading && linksError && (
          <EmptyState
            title="We could not load your links"
            description="The connection dropped while fetching your data. Nothing has changed — no payment was recorded or missed."
            action={{ label: "Try again", onClick: loadLinks }}
          />
        )}
        {!linksLoading && !linksError && filtered.length === 0 && (
          links.length === 0 ? (
            <EmptyState
              icon="links"
              title="Add your first worker"
              description="Once someone accepts your invite you can set a schedule, and Steward works out every due date from there."
              action={{ label: "Invite a worker", onClick: () => !atQuota && setShowModal(true) }}
              secondaryAction={{ label: "How it works", onClick: () => {} }}
            />
          ) : (
            <EmptyState
              icon="search"
              title={`No ${filter !== "All" ? filter.toLowerCase() : ""} links`}
              description="You have no links with this status. Clear the filter to see all."
              action={{ label: "Show all links", onClick: () => setFilter("All") }}
              secondaryAction={{ label: "Invite a worker", onClick: () => !atQuota && setShowModal(true) }}
            />
          )
        )}
        {!linksLoading && !linksError && filtered.length > 0 && (
          <div className="ds-table-wrap">
            <table className="ds-table ds-table--links">
              <thead>
                <tr>
                  {headers.map((h) => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id}>
                    <td className="lnk-name-cell">
                      <a href={`/manager/links/${l.id}`} className="ds-table-name-link">
                        {l.worker_name}
                      </a>
                    </td>
                    <td>{l.job_type}</td>
                    <td>{l.pay_schedule ?? "—"}</td>
                    <td className="st-num">{fmtMoney(l.base_amount, l.currency)}</td>
                    <td
                      className="st-num"
                      style={{
                        color: dueDateColor(l.status),
                        fontWeight: l.status.toLowerCase() !== "active" ? 800 : undefined,
                      }}
                    >
                      {fmtDate(l.next_due_date)}
                    </td>
                    <td className="st-num st-meta">{fmtDate(l.last_paid_date)}</td>
                    <td>
                      <span className={statusTagClass(l.status)}>{statusLabel(l.status)}</span>
                    </td>
                    <td className="lnk-action-cell">
                      <a
                        href={`/manager/links/${l.id}`}
                        className="st-btn st-btn--secondary ds-table-btn"
                      >
                        Open
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <AddLinkModal
          managerName={managerName}
          onClose={() => setShowModal(false)}
          onAdded={() => {
            setShowModal(false);
            loadLinks();
            api.manager.quota().then((res) => { if (res.data) setQuota(res.data); }).catch(() => {});
          }}
        />
      )}
    </>
  );
}
