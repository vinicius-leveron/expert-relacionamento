-- Migration: Create chat attachments and attachment embeddings
-- Stores user-uploaded files and their processed chunks per conversation

-- Private bucket for chat attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'application/json',
    'text/plain',
    'text/markdown',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Attachment metadata
CREATE TABLE IF NOT EXISTS public.chat_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  scope VARCHAR(20) NOT NULL DEFAULT 'conversation', -- 'conversation' | 'user_library'
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  sha256 VARCHAR(64),
  status VARCHAR(20) NOT NULL DEFAULT 'pending_upload', -- 'pending_upload' | 'uploaded' | 'processing' | 'ready' | 'failed'
  error_message TEXT,
  page_count INT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chat_attachments_scope_check CHECK (scope IN ('conversation', 'user_library')),
  CONSTRAINT chat_attachments_status_check CHECK (
    status IN ('pending_upload', 'uploaded', 'processing', 'ready', 'failed')
  ),
  CONSTRAINT chat_attachments_size_bytes_check CHECK (size_bytes >= 0)
);

-- Message to attachment links
CREATE TABLE IF NOT EXISTS public.message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  attachment_id UUID NOT NULL REFERENCES public.chat_attachments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT message_attachments_unique_link UNIQUE (message_id, attachment_id)
);

-- Chunks extracted from attachments for scoped retrieval
CREATE TABLE IF NOT EXISTS public.chat_attachment_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attachment_id UUID NOT NULL REFERENCES public.chat_attachments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536),
  chunk_index INT NOT NULL,
  token_count INT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Processing jobs for attachment ingestion
CREATE TABLE IF NOT EXISTS public.chat_attachment_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attachment_id UUID NOT NULL REFERENCES public.chat_attachments(id) ON DELETE CASCADE,
  job_type VARCHAR(50) NOT NULL DEFAULT 'ingest',
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'completed' | 'failed'
  attempt_count INT NOT NULL DEFAULT 0,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chat_attachment_jobs_status_check CHECK (
    status IN ('pending', 'processing', 'completed', 'failed')
  ),
  CONSTRAINT chat_attachment_jobs_attempt_count_check CHECK (attempt_count >= 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_attachments_user_conversation
  ON public.chat_attachments (user_id, conversation_id);

CREATE INDEX IF NOT EXISTS idx_chat_attachments_status
  ON public.chat_attachments (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_attachments_sha256
  ON public.chat_attachments (sha256)
  WHERE sha256 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id
  ON public.message_attachments (message_id);

CREATE INDEX IF NOT EXISTS idx_message_attachments_attachment_id
  ON public.message_attachments (attachment_id);

CREATE INDEX IF NOT EXISTS idx_chat_attachment_chunks_attachment_id
  ON public.chat_attachment_chunks (attachment_id);

CREATE INDEX IF NOT EXISTS idx_chat_attachment_chunks_conversation_id
  ON public.chat_attachment_chunks (conversation_id);

CREATE INDEX IF NOT EXISTS idx_chat_attachment_chunks_embedding
  ON public.chat_attachment_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_chat_attachment_jobs_attachment_id
  ON public.chat_attachment_jobs (attachment_id);

CREATE INDEX IF NOT EXISTS idx_chat_attachment_jobs_status
  ON public.chat_attachment_jobs (status, scheduled_at ASC);

-- Triggers
CREATE TRIGGER chat_attachments_updated_at
  BEFORE UPDATE ON public.chat_attachments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER chat_attachment_jobs_updated_at
  BEFORE UPDATE ON public.chat_attachment_jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.chat_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_attachment_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_attachment_jobs ENABLE ROW LEVEL SECURITY;

-- Service role policies
CREATE POLICY "Service role can manage chat_attachments"
  ON public.chat_attachments FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage message_attachments"
  ON public.message_attachments FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage chat_attachment_chunks"
  ON public.chat_attachment_chunks FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage chat_attachment_jobs"
  ON public.chat_attachment_jobs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Service role can manage chat attachment storage objects'
  ) THEN
    CREATE POLICY "Service role can manage chat attachment storage objects"
      ON storage.objects FOR ALL TO service_role
      USING (bucket_id = 'chat-attachments')
      WITH CHECK (bucket_id = 'chat-attachments');
  END IF;
END $$;

-- Comments
COMMENT ON TABLE public.chat_attachments IS 'User-uploaded attachments scoped to a chat conversation';
COMMENT ON TABLE public.message_attachments IS 'Links between chat messages and uploaded attachments';
COMMENT ON TABLE public.chat_attachment_chunks IS 'Scoped text chunks with embeddings extracted from chat attachments';
COMMENT ON TABLE public.chat_attachment_jobs IS 'Background ingestion jobs for chat attachments';
