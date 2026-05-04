ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.avatar_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'not_started',
  current_phase INT,
  completed_phases JSONB NOT NULL DEFAULT '[]'::jsonb,
  phase_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  profile_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_user_avatar_profile UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_avatar_profiles_user_id ON public.avatar_profiles (user_id);

CREATE TRIGGER avatar_profiles_updated_at
  BEFORE UPDATE ON public.avatar_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.avatar_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage avatar_profiles"
  ON public.avatar_profiles FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMENT ON TABLE public.avatar_profiles IS 'Structured avatar memory extracted from diagnostic conversations';
