CREATE TYPE subscription_status AS ENUM (
    'pending_payment',
    'active',
    'grace',
    'expired',
    'suspended'
);

CREATE TABLE subscriptions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manager_id        UUID NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
    status            subscription_status NOT NULL DEFAULT 'pending_payment',
    started_at        TIMESTAMPTZ,
    expires_at        TIMESTAMPTZ,
    grace_until       TIMESTAMPTZ,
    payment_ref       TEXT,
    amount_cents      INTEGER,
    currency          TEXT NOT NULL DEFAULT 'USD',
    activated_by      UUID REFERENCES users(id),
    activated_at      TIMESTAMPTZ,
    expiry_email_sent BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX subscriptions_manager_active_idx
    ON subscriptions (manager_id)
    WHERE status IN ('pending_payment', 'active', 'grace');

CREATE INDEX subscriptions_expires_at_idx ON subscriptions (expires_at) WHERE expires_at IS NOT NULL;

-- Seed every existing manager with a pending_payment subscription so the guard
-- immediately applies on deploy without breaking existing managers mid-session.
INSERT INTO subscriptions (manager_id)
SELECT id FROM managers
WHERE id NOT IN (SELECT manager_id FROM subscriptions);
