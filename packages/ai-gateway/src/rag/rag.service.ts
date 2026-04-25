import type { SupabaseClient } from '@supabase/supabase-js'
import type { EmbeddingPort } from '../embeddings/embedding.port.js'

export interface KnowledgeChunk {
  id: string
  documentId: string
  content: string
  similarity: number
  metadata: Record<string, unknown>
}

export interface RAGSearchOptions {
  matchThreshold?: number // 0-1, default 0.7
  matchCount?: number // default 5
}

export interface RAGServiceConfig {
  supabase: SupabaseClient
  embeddingProvider: EmbeddingPort
}

/**
 * RAGService - Retrieval Augmented Generation
 *
 * Busca chunks de conhecimento relevantes para uma query
 * usando similaridade de embeddings (pgvector).
 */
export class RAGService {
  private readonly supabase: SupabaseClient
  private readonly embedding: EmbeddingPort

  constructor(config: RAGServiceConfig) {
    this.supabase = config.supabase
    this.embedding = config.embeddingProvider
  }

  /**
   * Busca chunks relevantes para uma query
   */
  async search(query: string, options: RAGSearchOptions = {}): Promise<KnowledgeChunk[]> {
    const { matchThreshold = 0.7, matchCount = 5 } = options

    // 1. Gera embedding da query
    const { embedding } = await this.embedding.embed(query)

    // 2. Busca no Supabase usando a função RPC
    const { data, error } = await this.supabase.rpc('search_knowledge', {
      query_embedding: embedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
    })

    if (error) {
      throw new Error(`RAG search failed: ${error.message}`)
    }

    // 3. Mapeia para o formato de saída
    return (data ?? []).map((row: RawSearchResult) => ({
      id: row.id,
      documentId: row.document_id,
      content: row.content,
      similarity: row.similarity,
      metadata: row.metadata ?? {},
    }))
  }

  /**
   * Formata chunks para inserção no contexto da IA
   */
  formatForContext(chunks: KnowledgeChunk[]): string {
    if (chunks.length === 0) {
      return ''
    }

    const formatted = chunks.map((chunk, i) => `[${i + 1}] ${chunk.content}`).join('\n\n')

    return `---
CONHECIMENTO RELEVANTE:
${formatted}
---`
  }

  /**
   * Indexa um novo documento na base de conhecimento
   */
  async indexDocument(params: {
    title: string
    sourceType: 'pdf' | 'transcript' | 'article' | 'manual'
    sourceUrl?: string
    chunks: Array<{ content: string; metadata?: Record<string, unknown> }>
  }): Promise<string> {
    // 1. Cria o documento
    const { data: doc, error: docError } = await this.supabase
      .from('knowledge_documents')
      .insert({
        title: params.title,
        source_type: params.sourceType,
        source_url: params.sourceUrl,
      })
      .select('id')
      .single()

    if (docError || !doc) {
      throw new Error(`Failed to create document: ${docError?.message}`)
    }

    // 2. Gera embeddings em batch
    const texts = params.chunks.map((c) => c.content)
    const embeddings = await this.embedding.embedBatch(texts)

    // 3. Insere os chunks
    const chunksToInsert = params.chunks.map((chunk, index) => ({
      document_id: doc.id,
      content: chunk.content,
      embedding: embeddings[index].embedding,
      chunk_index: index,
      token_count: embeddings[index].tokenCount,
      metadata: chunk.metadata ?? {},
    }))

    const { error: chunksError } = await this.supabase
      .from('knowledge_chunks')
      .insert(chunksToInsert)

    if (chunksError) {
      throw new Error(`Failed to insert chunks: ${chunksError.message}`)
    }

    return doc.id
  }
}

interface RawSearchResult {
  id: string
  document_id: string
  content: string
  similarity: number
  metadata: Record<string, unknown> | null
}
