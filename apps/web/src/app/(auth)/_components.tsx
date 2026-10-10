// Shared auth page primitives

export function StewardLogo({ size = 22, light = false }: { size?: number; light?: boolean }) {
  return (
    <div
      className="auth-logo"
      style={{
        fontSize: size,
        color: light ? "var(--st-bg)" : "var(--st-text)",
      }}
    >
      <svg
        viewBox="0 2 16 19.4"
        className="auth-logo__icon"
        style={{ color: light ? "var(--st-accent-300)" : "var(--st-accent)" }}
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
  );
}

export function WorkerPaymentCard() {
  return (
    <div className="auth-wpc">
      <div className="auth-wpc__kicker">What your worker sees</div>
      <div className="auth-wpc__card">
        <div className="auth-wpc__card-kicker">Next payment due</div>
        <div className="auth-wpc__weekday">Thursday</div>
        <div className="auth-wpc__date">1 October</div>
        <div className="auth-wpc__date auth-wpc__date--spaced">2026</div>
        <div className="auth-wpc__amount-row">
          <div className="auth-wpc__amount">NGN 250,000</div>
          <div className="auth-wpc__amount-meta">
            Monthly, on the 1st · paid by Ngozi Adeyinka
          </div>
        </div>
      </div>
      <p className="auth-wpc__copy">
        No more asking when the money is coming. Your worker sees the date, the amount and the
        receipt for everything you have already sent.
      </p>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return <div className="auth-error-banner">{message}</div>;
}
