"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type LinkDetail, type LinkPayoutRow } from "@/lib/api";
import { uploadProof } from "@/lib/storage";
import { Toast, type ToastState } from "@/components/ds/Toast";
import { MoneyInput } from "@/components/ds/MoneyInput";
import { Select } from "@/components/ds/Select";
import { FileInput } from "@/components/ds/FileInput";
import { DatePicker } from "@/components/ds/DatePicker";
import { EmptyState } from "@/components/ds/EmptyState";

function statusClass(s: string): string {
  const v = s.toLowerCase();
  if (["active", "with_link", "paid", "completed", "verified"].includes(v)) return "st-tag st-tag--ok";
  if (["in_transit", "pending", "pending_review"].includes(v)) return "st-tag st-tag--pending";
  if (["overdue", "failed", "lost", "damaged"].includes(v)) return "st-tag st-tag--alert";
  return "st-tag st-tag--neutral";
}

function fmtMoney(minor: number | null | undefined, currency: string | null | undefined) {
  if (minor == null || currency == null) return "—";
  return `${currency} ${(minor / 100).toLocaleString("en-NG")}`;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}


// ── Record Payment Modal ──────────────────────────────────────────────────────

interface RecordPaymentModalProps {
  linkId: string;
  currency: string;
  onClose: () => void;
  onDone: () => void;
}

function RecordPaymentModal({ linkId, currency, onClose, onDone }: RecordPaymentModalProps) {
  const [amount, setAmount] = useState("");
  const [cur, setCur] = useState(currency);
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      let proof_key: string | undefined;
      if (proofFile) proof_key = await uploadProof(proofFile);
      await api.manager.recordPayment({
        link_id: linkId,
        base_amount: Math.round(Number(amount) * 100),
        currency: cur,
        paid_at: new Date(paidAt).toISOString(),
        notes: notes || undefined,
        proof_key,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="st-scrim"
      style={{ zIndex: 100 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="lnk-payment-sheet" role="dialog" aria-modal="true" aria-label="Record payment">
        <div className="lnk-sheet-handle" />
        <div className="lnk-sheet-hdr">
          <h2 className="st-dialog__title">Record payment</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="st-iconbtn">
            <svg width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="st-form">
          <div className="st-form__2col-asym">
            <div className="st-field">
              <label className="st-label" htmlFor="rp-amount">Amount</label>
              <MoneyInput id="rp-amount" value={amount} onChange={setAmount} placeholder="0.00" />
            </div>
            <div className="st-field">
              <label className="st-label" htmlFor="rp-currency">Currency</label>
              <Select
                id="rp-currency"
                value={cur}
                onChange={setCur}
                options={["NGN", "USD", "GBP", "EUR"].map((c) => ({ value: c, label: c }))}
              />
            </div>
          </div>

          <div className="st-field">
            <label className="st-label" htmlFor="rp-date">Date paid</label>
            <DatePicker id="rp-date" value={paidAt} onChange={setPaidAt} />
          </div>

          <div className="st-field">
            <label className="st-label" htmlFor="rp-notes">Notes (optional)</label>
            <textarea
              id="rp-notes"
              rows={2}
              className="st-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ resize: "none" }}
            />
          </div>

          <div className="st-field">
            <label className="st-label">Proof of payment (optional)</label>
            <FileInput
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              value={proofFile}
              onChange={setProofFile}
              hint="PDF, PNG or JPG · max 10 MB"
            />
          </div>

          {error && <div className="st-banner">{error}</div>}

          <div className="st-form__actions">
            <button type="submit" disabled={loading} className="st-btn st-btn--primary st-btn--lg st-btn--block">
              {loading ? "Recording…" : "Record payment"}
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

// ── Payouts table ─────────────────────────────────────────────────────────────

function PayoutsTable({
  payouts,
  currency,
  onRecordPayment,
}: {
  payouts: LinkPayoutRow[];
  currency: string;
  onRecordPayment?: () => void;
}) {
  if (payouts.length === 0) {
    return (
      <EmptyState
        icon="receipt"
        title="No payments recorded yet"
        description={`Use "Record payment" to log the first payment for this worker and attach the receipt.`}
        action={onRecordPayment ? { label: "Record a payment", onClick: onRecordPayment } : undefined}
      />
    );
  }

  return (
    <div className="ds-table-wrap">
      <table className="ds-table">
        <thead>
          <tr>
            {["Period", "Base", "Overtime", "Bonus", "Total", "Paid on", "Status", "Proof"].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {payouts.map((p) => (
            <tr key={p.id}>
              <td>{p.period_label}</td>
              <td className="st-num">{fmtMoney(p.base_amount, p.currency)}</td>
              <td className="st-num">{p.overtime_amount ? fmtMoney(p.overtime_amount, p.currency) : "—"}</td>
              <td className="st-num">{p.bonus_amount ? fmtMoney(p.bonus_amount, p.currency) : "—"}</td>
              <td className="st-num st-num--total">{fmtMoney(p.total_amount, p.currency)}</td>
              <td className="st-meta">{fmtDate(p.paid_at)}</td>
              <td><span className={statusClass(p.status)}>{p.status.replace(/_/g, " ")}</span></td>
              <td>
                {p.proof_of_payment ? (
                  <a href={p.proof_of_payment} target="_blank" rel="noopener noreferrer" className="ds-table-action-link">
                    View
                  </a>
                ) : (
                  <span className="st-meta">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LinkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [link, setLink] = useState<LinkDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api.manager
      .linkDetail(id)
      .then((res) => { setLink(res.data); setLoading(false); })
      .catch((err: Error) => { setError(err.message ?? "Failed to load link"); setLoading(false); });
  }

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <>
        <header className="st-header ds-page-header">
          <div className="st-skel" style={{ height: 16, width: 80 }} />
          <div className="st-skel" style={{ height: 22, width: 160 }} />
          <div className="st-skel" style={{ height: 20, width: 60 }} />
        </header>
        <div className="ds-page-body">
          {[100, 80, 90, 70, 85].map((w, i) => (
            <div key={i} className="st-skel" style={{ height: 16, width: `${w}%`, marginBottom: 14 }} />
          ))}
        </div>
      </>
    );
  }

  if (error || !link) {
    return (
      <div className="lnk-err-wrap">
        <p className="lnk-err-title">
          {error ? "We could not load this link" : "Link not found"}
        </p>
        {error && (
          <p className="st-small st-meta">
            The connection dropped while fetching this data. Nothing has changed.
          </p>
        )}
        <div className="lnk-err-actions">
          {error && (
            <button type="button" onClick={load} className="st-btn st-btn--primary">
              Try again
            </button>
          )}
          <Link href="/manager/links" className="lnk-back">← Back to links</Link>
        </div>
      </div>
    );
  }

  const infoFields = [
    { label: "Job type", value: link.job_type },
    { label: "Pay schedule", value: link.pay_schedule ?? "—" },
    { label: "Amount", value: fmtMoney(link.base_amount, link.currency) },
    { label: "Next due", value: fmtDate(link.next_due_date) },
    { label: "Last paid", value: fmtDate(link.last_paid_date) },
    { label: "Started", value: fmtDate(link.start_date) },
  ];

  return (
    <>
      {toast && <Toast state={toast} onDismiss={() => setToast(null)} />}

      <header className="st-header ds-page-header st-header--centered">
        <div className="lnk-breadcrumb-row">
          <Link href="/manager/links" className="lnk-breadcrumb">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            All links
          </Link>
          <span className="lnk-breadcrumb-sep">/</span>
          <h1 className="lnk-detail-title">{link.worker_name}</h1>
          <span className={statusClass(link.status)}>{link.status.replace(/_/g, " ")}</span>
        </div>
        <button type="button" onClick={() => setShowPayment(true)} className="st-btn st-btn--primary">
          Record payment
        </button>
      </header>

      <div className="lnk-body">
        <div className="lnk-info-grid">
          {infoFields.map((f) => (
            <div key={f.label} className="lnk-info-cell">
              <div className="lnk-info-label">{f.label}</div>
              <div className="lnk-info-value">{f.value}</div>
            </div>
          ))}
        </div>

        {(link.home_country || link.work_country) && (
          <div className="lnk-location-row">
            {link.home_country && (
              <span>
                <span className="lnk-location-key">Home: </span>
                {link.home_city ? `${link.home_city}, ` : ""}{link.home_country}
              </span>
            )}
            {link.work_country && (
              <span>
                <span className="lnk-location-key">Work: </span>
                {link.work_city ? `${link.work_city}, ` : ""}{link.work_country}
              </span>
            )}
          </div>
        )}

        <div className="lnk-section">
          <h4 className="st-section-title">Payment history</h4>
          <PayoutsTable
            payouts={link.payouts}
            currency={link.currency ?? "NGN"}
            onRecordPayment={() => setShowPayment(true)}
          />
        </div>
      </div>

      {showPayment && (
        <RecordPaymentModal
          linkId={link.id}
          currency={link.currency ?? "NGN"}
          onClose={() => setShowPayment(false)}
          onDone={() => {
            setShowPayment(false);
            setToast({ type: "success", message: "Payment recorded" });
            load();
          }}
        />
      )}
    </>
  );
}
