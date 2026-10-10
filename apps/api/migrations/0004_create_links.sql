CREATE TABLE links (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    manager_id            UUID        NOT NULL REFERENCES managers (id) ON DELETE RESTRICT,
    user_id               UUID        NOT NULL REFERENCES users (id)    ON DELETE RESTRICT,
    job_type              TEXT        NOT NULL,
    status                link_status NOT NULL DEFAULT 'pending',
    start_date            TIMESTAMPTZ NOT NULL,
    end_date              TIMESTAMPTZ,

    -- Where the link lives
    home_country          TEXT        NOT NULL,
    home_city             TEXT,
    home_state_province   TEXT,

    -- Where the link works from (may differ from home — e.g. a rented office or shop)
    work_country          TEXT        NOT NULL,
    work_city             TEXT,
    work_state_province   TEXT,

    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ
);

-- "Show all links for a manager" — the primary manager dashboard query.
CREATE INDEX idx_links_manager_id ON links (manager_id);

-- "Which managers does this user work for?"
CREATE INDEX idx_links_user_id ON links (user_id);

-- "Show all active links for a manager" — composite covers both filters at once.
CREATE INDEX idx_links_manager_status ON links (manager_id, status);

-- Regional reporting by home country or work country.
CREATE INDEX idx_links_home_country ON links (home_country);
CREATE INDEX idx_links_work_country ON links (work_country);
