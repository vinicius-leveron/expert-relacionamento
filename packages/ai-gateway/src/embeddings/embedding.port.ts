/**
 * EmbeddingPort - Interface para providers de embeddings
 *
 * Embeddings são vetores numéricos que representam texto semanticamente.
 * Usados para RAG (busca por similaridade).
 */
export interface EmbeddingResult {
  embedding: number[]
  tokenCount: number
}

export interface EmbeddingPort {
  readonly providerName: string
  readonly dimensions: number

  /**
   * Gera embedding para um texto
   */
  embed(text: string): Promise<EmbeddingResult>

  /**
   * Gera embeddings para múltiplos textos (batch)
   */
  embedBatch(texts: string[]): Promise<EmbeddingResult[]>
}
