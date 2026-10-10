CREATE TABLE link_payment_details (
    id                  UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id             UUID               NOT NULL REFERENCES links (id) ON DELETE CASCADE,
    payment_method      payment_method     NOT NULL,
    bank_name           TEXT,
    bank_account_number TEXT,
    preferred_currency  preferred_currency NOT NULL DEFAULT 'ngn',
    created_at          TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ
);

-- One payment detail record per link.
CREATE UNIQUE INDEX idx_link_payment_details_link_id ON link_payment_details (link_id);
