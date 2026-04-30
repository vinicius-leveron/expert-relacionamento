import type { KnowledgeChunk } from '@perpetuo/ai-gateway'
import type { KnowledgeDocumentRow, SupabaseClient } from '@perpetuo/database'

type SourceType = 'pdf' | 'transcript' | 'article' | 'manual'

export interface RagSearcher {
  search(
    query: string,
    options?: {
      matchThreshold?: number
      matchCount?: number
    },
  ): Promise<KnowledgeChunk[]>
}

export interface RagQueryOptions {
  count: number
  threshold: number
  limit: number
  listDocuments: boolean
  json: boolean
  sourceType?: SourceType
}

export interface IndexedDocumentSummary {
  id: string
  title: string
  sourceType: string
  sourceUrl?: string
  createdAt: string
  metadata: Record<string, unknown>
}

export interface RagSearchResult {
  id: string
  documentId: string
  title?: string
  sourceType?: string
  sourceUrl?: string
  similarity: number
  content: string
  metadata: Record<string, unknown>
  documentMetadata: Record<string, unknown>
}

export function parseRagQueryArgs(argv: string[]): {
  query?: string
  options: RagQueryOptions
  help: boolean
} {
  const options: RagQueryOptions = {
    count: 5,
    threshold: 0.7,
    limit: 20,
    listDocuments: false,
    json: false,
  }
  const positionals: string[] = []
  let help = false

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--help' || arg === '-h') {
      help = true
      continue
    }

    if (arg === '--list-docs') {
      options.listDocuments = true
      continue
    }

    if (arg === '--json') {
      options.json = true
      continue
    }

    if (arg === '--count') {
      const value = Number(argv[index + 1])
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error('--count precisa ser um número positivo')
      }
      options.count = value
      index += 1
      continue
    }

    if (arg === '--limit') {
      const value = Number(argv[index + 1])
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error('--limit precisa ser um número positivo')
      }
      options.limit = value
      index += 1
      continue
    }

    if (arg === '--threshold') {
      const value = Number(argv[index + 1])
      if (!Number.isFinite(value) || value <= 0 || value > 1) {
        throw new Error('--threshold precisa ser um número entre 0 e 1')
      }
      options.threshold = value
      index += 1
      continue
    }

    if (arg === '--source-type') {
      const value = argv[index + 1]
      if (!isSourceType(value)) {
        throw new Error('--source-type precisa ser um de: pdf, transcript, article, manual')
      }
      options.sourceType = value
      index += 1
      continue
    }

    positionals.push(arg)
  }

  return {
    query: positionals.join(' ').trim() || undefined,
    options,
    help,
  }
}

export async function listIndexedDocuments(params: {
  supabase: SupabaseClient
  limit?: number
  sourceType?: SourceType
}): Promise<IndexedDocumentSummary[]> {
  let query = params.supabase
    .from('knowledge_documents')
    .select('id, title, source_type, source_url, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(params.limit ?? 20)

  if (params.sourceType) {
    query = query.eq('source_type', params.sourceType)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`Failed to list indexed knowledge documents: ${error.message}`)
  }

  return (data ?? []).map(mapKnowledgeDocument)
}

export async function searchIndexedKnowledge(params: {
  rag: RagSearcher
  supabase: SupabaseClient
  query: string
  options?: Partial<RagQueryOptions>
}): Promise<RagSearchResult[]> {
  const count = params.options?.count ?? 5
  const threshold = params.options?.threshold ?? 0.7
  const sourceType = params.options?.sourceType
  const chunks = await params.rag.search(params.query, {
    matchThreshold: threshold,
    matchCount: count,
  })

  if (chunks.length === 0) {
    return []
  }

  const documentIds = [...new Set(chunks.map((chunk) => chunk.documentId))]
  let documentsQuery = params.supabase
    .from('knowledge_documents')
    .select('id, title, source_type, source_url, metadata, created_at')
    .in('id', documentIds)

  if (sourceType) {
    documentsQuery = documentsQuery.eq('source_type', sourceType)
  }

  const { data, error } = await documentsQuery
  if (error) {
    throw new Error(`Failed to load knowledge documents for search results: ${error.message}`)
  }

  const documentsById = new Map((data ?? []).map((document) => [document.id, mapKnowledgeDocument(document)]))

  const enrichedResults: Array<RagSearchResult | null> = chunks.map((chunk) => {
      const document = documentsById.get(chunk.documentId)
      if (!document) {
        return null
      }

      return {
        id: chunk.id,
        documentId: chunk.documentId,
        title: document.title,
        sourceType: document.sourceType,
        sourceUrl: document.sourceUrl,
        similarity: chunk.similarity,
        content: chunk.content,
        metadata: asRecord(chunk.metadata),
        documentMetadata: document.metadata,
      }
    })

  return enrichedResults.filter((value): value is RagSearchResult => value !== null)
}

export function formatIndexedDocuments(documents: IndexedDocumentSummary[]): string {
  if (documents.length === 0) {
    return 'Nenhum documento indexado.'
  }

  return documents
    .map((document) => {
      const contentHash = getStringMetadataValue(document.metadata, 'contentHash') ?? 'n/a'
      const sourcePath = getStringMetadataValue(document.metadata, 'sourcePath') ?? document.sourceUrl ?? 'n/a'
      return [
        `- [${document.sourceType}] ${document.title}`,
        `  source: ${sourcePath}`,
        `  created_at: ${document.createdAt}`,
        `  content_hash: ${contentHash}`,
      ].join('\n')
    })
    .join('\n\n')
}

export function formatSearchResults(results: RagSearchResult[]): string {
  if (results.length === 0) {
    return 'Nenhum chunk encontrado para essa busca.'
  }

  return results
    .map((result, index) => {
      const sectionTitle = getStringMetadataValue(result.metadata, 'sectionTitle')
      const preview = truncate(result.content, 280)
      const heading = `${index + 1}. [${result.similarity.toFixed(3)}] ${result.title ?? result.documentId}`
      const sourceLine = `   fonte: ${result.sourceType ?? 'desconhecido'}${result.sourceUrl ? ` · ${result.sourceUrl}` : ''}`
      const sectionLine = sectionTitle ? `   seção: ${sectionTitle}` : undefined
      const contentLine = `   trecho: ${preview}`

      return [heading, sourceLine, sectionLine, contentLine].filter(Boolean).join('\n')
    })
    .join('\n\n')
}

function mapKnowledgeDocument(document: Pick<
  KnowledgeDocumentRow,
  'id' | 'title' | 'source_type' | 'source_url' | 'metadata' | 'created_at'
>): IndexedDocumentSummary {
  return {
    id: document.id,
    title: document.title,
    sourceType: document.source_type,
    sourceUrl: document.source_url ?? undefined,
    createdAt: document.created_at,
    metadata: asRecord(document.metadata),
  }
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

function isSourceType(value: string | undefined): value is SourceType {
  return value === 'pdf' || value === 'transcript' || value === 'article' || value === 'manual'
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function getStringMetadataValue(
  metadata: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = metadata[key]
  return typeof value === 'string' ? value : undefined
}
