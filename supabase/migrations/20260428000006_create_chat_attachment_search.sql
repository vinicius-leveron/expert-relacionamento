-- Migration: scoped vector search for chat attachment chunks

CREATE OR REPLACE FUNCTION public.search_chat_attachment_chunks(
  query_embedding vector(1536),
  filter_user_id UUID,
  filter_conversation_id UUID,
  filter_attachment_ids UUID[] DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  attachment_id UUID,
  file_name TEXT,
  content TEXT,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    chunk.id,
    chunk.attachment_id,
    attachment.file_name::TEXT,
    chunk.content,
    1 - (chunk.embedding <=> query_embedding) AS similarity,
    chunk.metadata
  FROM public.chat_attachment_chunks chunk
  INNER JOIN public.chat_attachments attachment
    ON attachment.id = chunk.attachment_id
  WHERE chunk.user_id = filter_user_id
    AND chunk.conversation_id = filter_conversation_id
    AND attachment.status = 'ready'
    AND (
      filter_attachment_ids IS NULL
      OR chunk.attachment_id = ANY(filter_attachment_ids)
    )
    AND 1 - (chunk.embedding <=> query_embedding) > match_threshold
  ORDER BY chunk.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION public.search_chat_attachment_chunks IS
  'Scoped semantic search over chat attachment chunks by user and conversation';
