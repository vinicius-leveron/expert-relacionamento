-- Migration: Create users table
-- ADR 0011: User Identity Model - Opção A
-- UUID interno como PK; telefone e email como identidades externas

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_e164 VARCHAR(20) UNIQUE,
  email VARCHAR(255) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for identity lookups
CREATE INDEX IF NOT EXISTS idx_users_phone_e164 ON public.users (phone_e164) WHERE phone_e164 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email) WHERE email IS NOT NULL;

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- RLS (Row Level Security)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Service role can do anything
CREATE POLICY "Service role can manage users"
  ON public.users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comments
COMMENT ON TABLE public.users IS 'User identities - ADR 0011. id is internal UUID, phone_e164/email are external identities.';
COMMENT ON COLUMN public.users.id IS 'Internal UUID - never exposed in logs';
COMMENT ON COLUMN public.users.phone_e164 IS 'WhatsApp phone number in E.164 format';
COMMENT ON COLUMN public.users.email IS 'Email from app/checkout';
