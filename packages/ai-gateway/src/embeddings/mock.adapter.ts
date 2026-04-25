import type { EmbeddingPort, EmbeddingResult } from './embedding.port.js'

/**
 * MockEmbeddingAdapter - Para testes sem API key
 *
 * Gera embeddings determinísticos baseados no hash do texto.
 * NÃO usar em produção - apenas para desenvolvimento.
 */
export class MockEmbeddingAdapter implements EmbeddingPort {
  readonly providerName = 'mock'
  readonly dimensions = 1536

  async embed(text: string): Promise<EmbeddingResult> {
    return {
      embedding: this.generateMockEmbedding(text),
      tokenCount: Math.ceil(text.length / 4),
    }
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    return texts.map((text) => ({
      embedding: this.generateMockEmbedding(text),
      tokenCount: Math.ceil(text.length / 4),
    }))
  }

  /**
   * Gera embedding determinístico baseado no texto
   * Útil para testes onde precisamos de consistência
   */
  private generateMockEmbedding(text: string): number[] {
    const embedding: number[] = []
    let hash = 0

    // Simple hash function
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }

    // Generate deterministic embedding from hash
    const seed = Math.abs(hash)
    for (let i = 0; i < this.dimensions; i++) {
      // Pseudo-random but deterministic value between -1 and 1
      const value = Math.sin(seed * (i + 1)) * 0.5
      embedding.push(value)
    }

    // Normalize to unit vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    return embedding.map((val) => val / magnitude)
  }
}
