CREATE TABLE device_assignments (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id   UUID        NOT NULL REFERENCES devices (id)  ON DELETE RESTRICT,
    link_id     UUID        NOT NULL REFERENCES links (id)    ON DELETE RESTRICT,
    assigned_by UUID        NOT NULL REFERENCES managers (id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    returned_at TIMESTAMPTZ,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- "Who currently holds this device?" — the most frequent query; partial keeps it tiny.
CREATE INDEX idx_device_assignments_current
    ON device_assignments (device_id)
    WHERE returned_at IS NULL;

-- "What devices does this link currently hold?"
CREATE INDEX idx_device_assignments_link_active
    ON device_assignments (link_id)
    WHERE returned_at IS NULL;

-- Full custody history for a device ordered by time.
CREATE INDEX idx_device_assignments_history
    ON device_assignments (device_id, assigned_at DESC);
