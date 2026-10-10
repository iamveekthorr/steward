import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="lp-grid">
      {/* Left panel */}
      <div className="lp-left">
        {/* Logo */}
        <div className="lp-logo">
          <svg
            viewBox="0 2 16 19.4"
            className="lp-logo__icon"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.9"
            strokeLinecap="square"
            aria-hidden="true"
          >
            <path d="M14 3.5H6.2a4.1 4.1 0 0 0 0 8.2h3.6a4.1 4.1 0 0 1 0 8.2H2" />
            <path d="M11.5 1L14 3.5L11.5 6M4.5 17.4L2 19.9L4.5 22.4" />
          </svg>
          <span>teward</span>
        </div>

        {/* Hero */}
        <div className="lp-hero">
          <h1 className="lp-headline">
            Pay the people you employ back home on the day you promised.
          </h1>
          <p className="lp-subhead">
            Set a schedule once. Steward works out every due date, reminds you before it lands, and
            keeps a receipt for every transfer.
          </p>

          <div className="lp-cta-row">
            <Link href="/login" className="lp-btn-primary">
              Sign in
            </Link>
            <Link href="/register" className="lp-btn-outline">
              Create an account
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div className="lp-stats">
          {[
            { value: "NGN · USD", label: "Currencies" },
            { value: "Every payout", label: "Receipt kept" },
            { value: "No drift", label: "Anchored schedules" },
          ].map((s) => (
            <div key={s.label}>
              <div className="lp-stat__value">{s.value}</div>
              <div className="lp-stat__label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="lp-right">
        <div className="lp-preview-kicker">What your worker sees</div>
        <div className="lp-preview-card">
          <div className="lp-preview-card__kicker">Next payment due</div>
          <div className="lp-preview-date">
            <span className="lp-preview-weekday">Thursday</span>
            <span className="lp-preview-date__big">1 October</span>
            <span className="lp-preview-date__big">2026</span>
          </div>
          <div className="lp-preview-amount-row">
            <div className="lp-preview-amount">NGN 250,000</div>
            <div className="lp-preview-amount__meta">
              Monthly, on the 1st · paid by Ngozi Adeyinka
            </div>
          </div>
        </div>
        <p className="lp-right-copy">
          No more asking when the money is coming. Your worker sees the date, the amount and the
          receipt for everything you have already sent.
        </p>
      </div>
    </div>
  );
}
