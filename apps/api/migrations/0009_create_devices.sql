CREATE TABLE devices (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    manager_id      UUID          NOT NULL REFERENCES managers (id) ON DELETE RESTRICT,
    device_type     device_type   NOT NULL,
    name            TEXT          NOT NULL,
    model           TEXT,
    serial_number   TEXT,
    status          device_status NOT NULL DEFAULT 'with_manager',
    current_link_id UUID          REFERENCES links (id),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);

-- "List all devices owned by this manager."
CREATE INDEX idx_devices_manager_id ON devices (manager_id);

-- "Which link currently holds this device?" — partial: only rows where assigned.
CREATE INDEX idx_devices_current_link_id
    ON devices (current_link_id)
    WHERE current_link_id IS NOT NULL;
