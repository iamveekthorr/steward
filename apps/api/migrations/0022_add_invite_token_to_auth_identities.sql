ALTER TABLE auth_identities
  ADD COLUMN invite_token           UUID UNIQUE,
  ADD COLUMN invite_token_expires_at TIMESTAMPTZ;

CREATE INDEX idx_auth_identities_invite_token
  ON auth_identities (invite_token)
  WHERE invite_token IS NOT NULL;
