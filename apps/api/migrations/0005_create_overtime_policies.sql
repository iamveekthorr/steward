CREATE TABLE overtime_policies (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    manager_id       UUID        NOT NULL REFERENCES managers (id) ON DELETE CASCADE,
    name             TEXT        NOT NULL,
    overtime_enabled BOOLEAN     NOT NULL DEFAULT FALSE,
    multiplier       NUMERIC(5, 2),          -- e.g. 1.50, 2.00; mutually exclusive with flat_rate
    flat_rate        BIGINT,                 -- fixed amount per OT hour in minor currency units
    threshold_hours  INTEGER,                -- regular hours per period before OT kicks in
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ,

    CONSTRAINT chk_overtime_rate CHECK (
        (multiplier IS NULL) != (flat_rate IS NULL) -- exactly one must be set when policy is active
        OR (multiplier IS NULL AND flat_rate IS NULL) -- both NULL is fine (policy disabled)
    )
);

-- "List all overtime policies for this manager."
CREATE INDEX idx_overtime_policies_manager_id ON overtime_policies (manager_id);
