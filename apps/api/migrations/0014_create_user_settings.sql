CREATE TABLE user_settings (
    id                         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    theme                      TEXT        NOT NULL DEFAULT 'system',
    enable_email_notifications BOOLEAN     NOT NULL DEFAULT TRUE,
    reminder_days_before       INTEGER     NOT NULL DEFAULT 3,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ
);

-- One settings record per user.
CREATE UNIQUE INDEX idx_user_settings_user_id ON user_settings (user_id);
