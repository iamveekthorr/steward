-- All PostgreSQL enum types must exist before any table references them.
-- Variant names use snake_case to match sqlx rename_all = "snake_case" on the Rust enums.

CREATE TYPE link_status AS ENUM (
    'pending',
    'active',
    'inactive',
    'suspended',
    'terminated'
);

CREATE TYPE manager_status AS ENUM (
    'pending',
    'verified',
    'suspended',
    'revoked'
);

CREATE TYPE pay_schedule AS ENUM (
    'daily',
    'weekly',
    'biweekly',
    'semi_monthly',
    'monthly',
    'custom'
);

CREATE TYPE payment_method AS ENUM (
    'bank_transfer',
    'debit_card',
    'mobile_money',
    'cash'
);

CREATE TYPE payout_status AS ENUM (
    'pending',
    'completed',
    'failed',
    'cancelled'
);

CREATE TYPE preferred_currency AS ENUM (
    'ngn',
    'usd',
    'gbp',
    'eur',
    'cad'
);

CREATE TYPE device_status AS ENUM (
    'with_manager',
    'in_transit',
    'with_link',
    'offline',
    'lost'
);

CREATE TYPE device_type AS ENUM (
    'laptop',
    'cpu',
    'phone',
    'byod'
);

CREATE TYPE router_type AS ENUM (
    'flint',
    'gli_net',
    'others'
);
