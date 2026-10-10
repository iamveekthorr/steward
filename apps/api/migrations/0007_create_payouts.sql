CREATE TABLE payouts (
    id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id           UUID          NOT NULL REFERENCES links (id)                  ON DELETE RESTRICT,
    paid_by           UUID          NOT NULL REFERENCES managers (id),
    payment_config_id UUID          NOT NULL REFERENCES payment_configurations (id),
    period_start      TIMESTAMPTZ   NOT NULL,
    period_end        TIMESTAMPTZ   NOT NULL,
    base_amount       BIGINT        NOT NULL,
    overtime_amount   BIGINT,
    bonus_amount      BIGINT,
    total_amount      BIGINT        NOT NULL,
    currency          TEXT          NOT NULL,
    proof_of_payment  TEXT,                   -- file reference (S3 key or URL)
    notes             TEXT,
    status            payout_status NOT NULL DEFAULT 'pending',
    paid_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- "Payment history for a link" — ordered newest first.
CREATE INDEX idx_payouts_link_history
    ON payouts (link_id, paid_at DESC);

-- "Total paid by a manager this month."
CREATE INDEX idx_payouts_paid_by
    ON payouts (paid_by, paid_at DESC);

-- FK lookup when verifying which config governed a payout.
CREATE INDEX idx_payouts_payment_config_id
    ON payouts (payment_config_id);

-- Find pending payouts that need attention (small set — partial index stays tiny).
CREATE INDEX idx_payouts_pending
    ON payouts (status)
    WHERE status = 'pending';
