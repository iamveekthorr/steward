CREATE TABLE managers (
    id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID           NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status       manager_status NOT NULL DEFAULT 'pending',
    verified_by  UUID           REFERENCES users (id),
    verified_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ
);

-- One user → at most one manager record.
CREATE UNIQUE INDEX idx_managers_user_id ON managers (user_id);

-- Dashboard filter: "find all pending managers awaiting verification".
CREATE INDEX idx_managers_status ON managers (status);
