ALTER TABLE auth_identities
  ADD COLUMN password_reset_token           UUID,
  ADD COLUMN password_reset_token_expires_at TIMESTAMPTZ;

CREATE INDEX idx_auth_identities_reset_token
  ON auth_identities (password_reset_token)
  WHERE password_reset_token IS NOT NULL;
