CREATE TABLE router_gateways (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    manager_id      UUID          NOT NULL REFERENCES managers (id) ON DELETE RESTRICT,
    name            TEXT          NOT NULL,
    routes_to       TEXT          NOT NULL,  -- US location the VPN tunnels back to
    ip_addr         INET          NOT NULL,
    router_type     router_type   NOT NULL,
    status          device_status NOT NULL DEFAULT 'with_manager',
    current_link_id UUID          REFERENCES links (id),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);

-- "List all routers owned by this manager."
CREATE INDEX idx_router_gateways_manager_id ON router_gateways (manager_id);

-- "Which link currently holds this router?"
CREATE INDEX idx_router_gateways_current_link_id
    ON router_gateways (current_link_id)
    WHERE current_link_id IS NOT NULL;
