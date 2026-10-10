CREATE TABLE payment_configurations (
    id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id            UUID         NOT NULL REFERENCES links (id)             ON DELETE RESTRICT,
    configured_by      UUID         NOT NULL REFERENCES managers (id),
    pay_schedule       pay_schedule NOT NULL,
    pay_interval_count INTEGER,              -- only set when pay_schedule = 'custom'
    pay_day            SMALLINT,             -- day of week (0-6) or day of month (1-31)
    base_amount        BIGINT       NOT NULL, -- in minor currency units (e.g. kobo, cents)
    currency           TEXT         NOT NULL DEFAULT 'NGN',
    overtime_policy_id UUID         REFERENCES overtime_policies (id),
    cycle_anchor_date  TIMESTAMPTZ  NOT NULL, -- epoch; all due dates derived from this
    next_due_date      TIMESTAMPTZ  NOT NULL, -- materialized cache; updated after each notification
    valid_from         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    valid_until        TIMESTAMPTZ,           -- NULL = currently active version
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_custom_interval CHECK (
        pay_schedule != 'custom' OR pay_interval_count IS NOT NULL
    )
);

-- Notification job: WHERE next_due_date::date = CURRENT_DATE AND valid_until IS NULL
-- Partial index on active configs only — keeps the scan small regardless of history size.
CREATE INDEX idx_payment_config_next_due
    ON payment_configurations (next_due_date)
    WHERE valid_until IS NULL;

-- "Get the active config for a link" — used on every link detail page load.
CREATE INDEX idx_payment_config_link_active
    ON payment_configurations (link_id)
    WHERE valid_until IS NULL;

-- "Show full config history for a link ordered by time."
CREATE INDEX idx_payment_config_link_history
    ON payment_configurations (link_id, valid_from DESC);
