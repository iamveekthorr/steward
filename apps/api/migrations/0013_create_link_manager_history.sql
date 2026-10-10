CREATE TABLE link_manager_history (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id          UUID        NOT NULL REFERENCES links (id)    ON DELETE RESTRICT,
    from_manager_id  UUID        REFERENCES managers (id),          -- NULL on initial link creation
    to_manager_id    UUID        NOT NULL REFERENCES managers (id),
    transferred_by   UUID        NOT NULL REFERENCES users (id),    -- who authorized the transfer
    worker_consented BOOLEAN     NOT NULL DEFAULT FALSE,
    transfer_notes   TEXT,
    effective_from   TIMESTAMPTZ NOT NULL,
    effective_until  TIMESTAMPTZ,                                   -- NULL = this manager is current
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- "Who managed this link on date X?" — temporal query, spans entire history.
CREATE INDEX idx_link_manager_history_link_id
    ON link_manager_history (link_id, effective_from DESC);

-- "Who is the current manager of this link?"
CREATE INDEX idx_link_manager_history_current
    ON link_manager_history (link_id)
    WHERE effective_until IS NULL;

-- Compliance: "find all transfers without worker consent."
CREATE INDEX idx_link_manager_history_no_consent
    ON link_manager_history (worker_consented)
    WHERE worker_consented = FALSE;
