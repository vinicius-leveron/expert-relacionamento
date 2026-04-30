-- Migration: Create conversations, messages, diagnostics
-- Stores chat history and user journey data

-- Conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL DEFAULT 'whatsapp', -- 'whatsapp', 'web', 'app'
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'archived'
  summary TEXT, -- Compressed summary of old messages
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- 'user', 'assistant'
  content TEXT NOT NULL,
  content_type VARCHAR(20) NOT NULL DEFAULT 'text', -- 'text', 'image', 'audio'
  metadata JSONB DEFAULT '{}', -- tokens used, latency, etc
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Diagnostics table (stores archetype diagnosis results)
CREATE TABLE IF NOT EXISTS public.diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  archetype VARCHAR(50) NOT NULL, -- 'provedor', 'aventureiro', 'romantico', 'racional'
  scores JSONB NOT NULL DEFAULT '{}', -- Score per archetype for transparency
  answers JSONB NOT NULL DEFAULT '[]', -- User answers to diagnostic questions
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Only one active diagnosis per user
  CONSTRAINT unique_user_diagnosis UNIQUE (user_id)
);

-- User journey tracking
CREATE TABLE IF NOT EXISTS public.journey_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  current_day INT NOT NULL DEFAULT 1, -- Day in 30-day journey
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'paused', 'completed', 'churned'

  CONSTRAINT unique_user_journey UNIQUE (user_id)
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  external_id VARCHAR(255) NOT NULL, -- ID in payment gateway
  gateway VARCHAR(50) NOT NULL, -- 'hotmart', 'kiwify', 'stripe'
  plan_id VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'active', 'cancelled', 'expired', 'pending'
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diagnostics_user_id ON public.diagnostics (user_id);
CREATE INDEX IF NOT EXISTS idx_journey_progress_user_id ON public.journey_progress (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_external_id ON public.subscriptions (external_id);

-- Triggers
CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Service role policies
CREATE POLICY "Service role can manage conversations"
  ON public.conversations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage messages"
  ON public.messages FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage diagnostics"
  ON public.diagnostics FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage journey_progress"
  ON public.journey_progress FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage subscriptions"
  ON public.subscriptions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Comments
COMMENT ON TABLE public.conversations IS 'Chat sessions between user and Isabela';
COMMENT ON TABLE public.messages IS 'Individual messages in conversations';
COMMENT ON TABLE public.diagnostics IS 'Archetype diagnosis results per user';
COMMENT ON TABLE public.journey_progress IS 'User progress in 30-day journey';
COMMENT ON TABLE public.subscriptions IS 'Payment subscriptions from external gateways';
