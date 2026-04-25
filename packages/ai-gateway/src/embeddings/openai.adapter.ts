import type { EmbeddingPort, EmbeddingResult } from './embedding.port.js'

export interface OpenAIEmbeddingConfig {
  apiKey?: string
  model?: string
}

const DEFAULT_MODEL = 'text-embedding-ada-002'
const DIMENSIONS = 1536

/**
 * OpenAIEmbeddingAdapter - Embeddings usando OpenAI
 *
 * Modelo padrão: text-embedding-ada-002 (1536 dimensões)
 * Alternativa: text-embedding-3-small (1536) ou text-embedding-3-large (3072)
 */
export class OpenAIEmbeddingAdapter implements EmbeddingPort {
  readonly providerName = 'openai'
  readonly dimensions = DIMENSIONS

  private readonly apiKey: string
  private readonly model: string

  constructor(config: OpenAIEmbeddingConfig = {}) {
    const apiKey = config.apiKey ?? process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for embeddings')
    }
    this.apiKey = apiKey
    this.model = config.model ?? DEFAULT_MODEL
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const results = await this.embedBatch([text])
    return results[0]
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI embedding failed: ${error}`)
    }

    const data = (await response.json()) as OpenAIEmbeddingResponse

    return data.data.map((item, index) => ({
      embedding: item.embedding,
      tokenCount: data.usage.prompt_tokens / texts.length, // Aproximação
    }))
  }
}

interface OpenAIEmbeddingResponse {
  data: Array<{
    embedding: number[]
    index: number
  }>
  usage: {
    prompt_tokens: number
    total_tokens: number
  }
}
