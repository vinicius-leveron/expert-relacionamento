import { describe, expect, it } from 'vitest'
import {
  formatIndexedDocuments,
  formatSearchResults,
  parseRagQueryArgs,
  searchIndexedKnowledge,
} from './rag-query.js'

describe('rag-query', () => {
  it('parseia argumentos para busca e listagem', () => {
    const parsed = parseRagQueryArgs([
      '--list-docs',
      '--source-type',
      'manual',
      '--limit',
      '12',
      '--json',
    ])

    expect(parsed.query).toBeUndefined()
    expect(parsed.options).toMatchObject({
      listDocuments: true,
      sourceType: 'manual',
      limit: 12,
      json: true,
    })

    const parsedSearch = parseRagQueryArgs([
      'abertura',
      'de',
      'conversa',
      '--count',
      '8',
      '--threshold',
      '0.65',
    ])

    expect(parsedSearch.query).toBe('abertura de conversa')
    expect(parsedSearch.options).toMatchObject({
      count: 8,
      threshold: 0.65,
    })
  })

  it('enriquece busca semântica com metadados do documento e respeita filtro de source_type', async () => {
    const results = await searchIndexedKnowledge({
      query: 'sumiço',
      options: {
        sourceType: 'manual',
      },
      rag: {
        async search() {
          return [
            {
              id: 'chunk-1',
              documentId: 'doc-manual',
              content: 'Sugestão prática para retomar a conversa.',
              similarity: 0.91,
              metadata: {
                sectionTitle: 'Retomada',
              },
            },
            {
              id: 'chunk-2',
              documentId: 'doc-transcript',
              content: 'Trecho de transcrição que não deve aparecer.',
              similarity: 0.88,
              metadata: {},
            },
          ]
        },
      },
      supabase: {
        from() {
          return {
            select() {
              return {
                in(_column: string, ids: string[]) {
                  return createThenableDocumentQuery(
                    ids
                      .map((id) => documents.find((document) => document.id === id))
                      .filter((value): value is (typeof documents)[number] => Boolean(value)),
                  )
                },
              }
            },
          }
        },
      } as never,
    })

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      id: 'chunk-1',
      documentId: 'doc-manual',
      title: 'Playbook',
      sourceType: 'manual',
      sourceUrl: 'playbooks/retomada',
      documentMetadata: {
        sourcePath: 'docs/playbook.md',
      },
    })
  })

  it('formata listagem de documentos e resultados de busca para terminal', () => {
    const documentsOutput = formatIndexedDocuments([
      {
        id: 'doc-1',
        title: 'Playbook de retomada',
        sourceType: 'manual',
        sourceUrl: 'playbooks/retomada',
        createdAt: '2026-04-28T12:00:00Z',
        metadata: {
          sourcePath: 'docs/playbook.md',
          contentHash: 'abc123',
        },
      },
    ])

    expect(documentsOutput).toContain('[manual] Playbook de retomada')
    expect(documentsOutput).toContain('content_hash: abc123')

    const searchOutput = formatSearchResults([
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        title: 'Playbook de retomada',
        sourceType: 'manual',
        sourceUrl: 'playbooks/retomada',
        similarity: 0.9123,
        content: 'Uma resposta curta, segura e direta para reabrir a conversa.',
        metadata: {
          sectionTitle: 'Mensagens de retomada',
        },
        documentMetadata: {},
      },
    ])

    expect(searchOutput).toContain('[0.912] Playbook de retomada')
    expect(searchOutput).toContain('seção: Mensagens de retomada')
    expect(searchOutput).toContain('trecho: Uma resposta curta, segura e direta')
  })
})

const documents = [
  {
    id: 'doc-manual',
    title: 'Playbook',
    source_type: 'manual',
    source_url: 'playbooks/retomada',
    metadata: {
      sourcePath: 'docs/playbook.md',
    },
    created_at: '2026-04-28T12:00:00Z',
  },
  {
    id: 'doc-transcript',
    title: 'Aula 01',
    source_type: 'transcript',
    source_url: 'transcripts/aula-01',
    metadata: {
      sourcePath: 'docs/aula-01.json',
    },
    created_at: '2026-04-28T11:00:00Z',
  },
]

function createThenableDocumentQuery(data: typeof documents) {
  return {
    eq(column: string, value: string) {
      return createThenableDocumentQuery(data.filter((document) => document[column as 'source_type'] === value))
    },
    then<TResult1 = { data: typeof documents; error: null }, TResult2 = never>(
      onfulfilled?:
        | ((value: { data: typeof documents; error: null }) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      return Promise.resolve({ data, error: null }).then(onfulfilled, onrejected)
    },
  }
}
