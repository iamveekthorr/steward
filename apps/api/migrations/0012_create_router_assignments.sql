CREATE TABLE router_assignments (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    router_id   UUID        NOT NULL REFERENCES router_gateways (id) ON DELETE RESTRICT,
    link_id     UUID        NOT NULL REFERENCES links (id)            ON DELETE RESTRICT,
    assigned_by UUID        NOT NULL REFERENCES managers (id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    returned_at TIMESTAMPTZ,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- "Which link currently holds this router?"
CREATE INDEX idx_router_assignments_current
    ON router_assignments (router_id)
    WHERE returned_at IS NULL;

-- "What routers does this link currently hold?"
CREATE INDEX idx_router_assignments_link_active
    ON router_assignments (link_id)
    WHERE returned_at IS NULL;

-- Full custody history for a router.
CREATE INDEX idx_router_assignments_history
    ON router_assignments (router_id, assigned_at DESC);
