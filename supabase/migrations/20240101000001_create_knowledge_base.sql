-- Migration: Create knowledge base for RAG
-- Stores documents and embeddings for semantic search

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents table (source files: PDFs, transcripts, etc)
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  source_type VARCHAR(50) NOT NULL, -- 'pdf', 'transcript', 'article', 'manual'
  source_url TEXT, -- Original URL or file path
  metadata JSONB DEFAULT '{}', -- Flexible metadata (author, date, tags, etc)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chunks table (pieces of documents with embeddings)
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL, -- The actual text chunk
  embedding vector(1536), -- OpenAI ada-002 dimension
  chunk_index INT NOT NULL, -- Order within document
  token_count INT, -- Approximate token count
  metadata JSONB DEFAULT '{}', -- Section title, page number, etc
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for vector similarity search (IVFFlat for speed)
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
  ON public.knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Index for document lookup
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document_id
  ON public.knowledge_chunks (document_id);

-- Function for semantic search
CREATE OR REPLACE FUNCTION public.search_knowledge(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.document_id,
    kc.content,
    1 - (kc.embedding <=> query_embedding) AS similarity,
    kc.metadata
  FROM public.knowledge_chunks kc
  WHERE 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Updated at trigger for documents
CREATE TRIGGER knowledge_documents_updated_at
  BEFORE UPDATE ON public.knowledge_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Service role policies
CREATE POLICY "Service role can manage knowledge_documents"
  ON public.knowledge_documents FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage knowledge_chunks"
  ON public.knowledge_chunks FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Comments
COMMENT ON TABLE public.knowledge_documents IS 'Source documents for RAG (PDFs, transcripts, articles)';
COMMENT ON TABLE public.knowledge_chunks IS 'Text chunks with embeddings for semantic search';
COMMENT ON FUNCTION public.search_knowledge IS 'Semantic search using cosine similarity';
