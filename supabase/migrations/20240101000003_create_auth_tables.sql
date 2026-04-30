-- Migration: Auth tables for App authentication
-- Sessions: Stores refresh tokens for JWT auth
-- Magic Links: Stores one-time tokens for passwordless auth

-- Sessions table for refresh token management
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  device_info JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON sessions(refresh_token_hash);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at) WHERE revoked_at IS NULL;

-- Magic links table for passwordless authentication
CREATE TABLE magic_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_magic_links_token_hash ON magic_links(token_hash);
CREATE INDEX idx_magic_links_email ON magic_links(email);

-- Verification codes for WhatsApp linking
CREATE TABLE verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'link_whatsapp',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_verification_codes_user_id ON verification_codes(user_id);
CREATE INDEX idx_verification_codes_code ON verification_codes(code);

-- Function to clean up expired sessions and magic links
CREATE OR REPLACE FUNCTION cleanup_expired_auth()
RETURNS void AS $$
BEGIN
  DELETE FROM sessions WHERE expires_at < NOW() OR revoked_at IS NOT NULL;
  DELETE FROM magic_links WHERE expires_at < NOW() OR used_at IS NOT NULL;
  DELETE FROM verification_codes WHERE expires_at < NOW() OR used_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql;
