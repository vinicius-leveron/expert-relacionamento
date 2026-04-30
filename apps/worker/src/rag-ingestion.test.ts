import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  chunkDocument,
  extractTextFromJson,
  inferSourceType,
  ingestRagSources,
  parseIngestionArgs,
  prepareDocument,
} from './rag-ingestion.js'

const tempDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      rm(directory, {
        recursive: true,
        force: true,
      }),
    ),
  )
})

describe('rag-ingestion', () => {
  it('parseia argumentos do CLI com manifest e flags principais', () => {
    const parsed = parseIngestionArgs([
      '--manifest',
      'rag-manifest.json',
      'docs',
      '--replace',
      '--chunk-size',
      '900',
      '--chunk-overlap',
      '120',
      '--source-url-prefix',
      'https://conteudo.local',
    ])

    expect(parsed.paths).toEqual(['docs'])
    expect(parsed.options).toMatchObject({
      manifestPath: 'rag-manifest.json',
      replaceExisting: true,
      chunkSize: 900,
      chunkOverlap: 120,
      sourceUrlPrefix: 'https://conteudo.local',
    })
  })

  it('extrai texto útil de JSONs de transcrição', () => {
    const text = extractTextFromJson({
      title: 'Aula 01',
      segments: [
        { speaker: 'Isabela', text: 'Hoje vamos falar sobre constância.' },
        { speaker: 'Aluno', text: 'Tenho dificuldade em manter ritmo.' },
      ],
      summary: 'Diagnóstico inicial da turma.',
    })

    expect(text).toContain('# Aula 01')
    expect(text).toContain('Isabela: Hoje vamos falar sobre constância.')
    expect(text).toContain('Aluno: Tenho dificuldade em manter ritmo.')
    expect(text).toContain('Diagnóstico inicial da turma.')
  })

  it('quebra texto longo em chunks com metadata de seção e base metadata', () => {
    const content = `# Introdução

${'A'.repeat(700)}

# Exercício

${'B'.repeat(700)}
`

    const chunks = chunkDocument(
      content,
      {
        chunkSize: 600,
        chunkOverlap: 100,
      },
      { author: 'Isabela' },
    )

    expect(chunks.length).toBeGreaterThan(2)
    expect(chunks[0]?.metadata).toMatchObject({
      author: 'Isabela',
      sectionTitle: 'Introdução',
      chunkIndex: 0,
    })
    expect(chunks.some((chunk) => chunk.content.includes('Exercício'))).toBe(true)
  })

  it('infere source_type a partir do nome do arquivo', () => {
    expect(inferSourceType('/tmp/isabela-transcript-01.json')).toBe('transcript')
    expect(inferSourceType('/tmp/playbook-de-respostas.md')).toBe('manual')
    expect(inferSourceType('/tmp/perfil-romantico.pdf')).toBe('pdf')
    expect(inferSourceType('/tmp/artigo-sinais.txt')).toBe('article')
  })

  it('aplica overrides do manifest e inclui metadata/hash do documento', async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'rag-ingestion-'))
    tempDirectories.push(cwd)

    const filePath = path.join(cwd, 'conteudo', 'guia.md')
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(
      filePath,
      '# Guia\n\nEsse material fala sobre constância emocional e práticas simples.',
      'utf8',
    )

    const prepared = await prepareDocument(
      filePath,
      {
        cwd,
        chunkSize: 300,
        chunkOverlap: 50,
        sourceUrlPrefix: 'https://origem.local',
      },
      {
        path: 'conteudo/guia.md',
        title: 'Guia Curado',
        sourceType: 'manual',
        sourceUrl: 'guides/guia-curado',
        metadata: { author: 'Isabela', tags: ['constancia'] },
        chunkMetadata: { audience: 'mvp' },
      },
      {
        filePath: path.join(cwd, 'rag-manifest.json'),
        defaults: {
          metadata: { project: 'perpetuo' },
          chunkMetadata: { tone: 'pratico' },
        },
        documents: new Map(),
      },
    )

    expect(prepared.title).toBe('Guia Curado')
    expect(prepared.sourceType).toBe('manual')
    expect(prepared.sourceUrl).toBe('guides/guia-curado')
    expect(prepared.metadata).toMatchObject({
      author: 'Isabela',
      project: 'perpetuo',
      sourcePath: 'conteudo/guia.md',
      chunking: {
        size: 300,
        overlap: 50,
      },
    })
    expect(prepared.metadata.contentHash).toMatch(/^[a-f0-9]{64}$/)
    expect(prepared.chunks[0]?.metadata).toMatchObject({
      audience: 'mvp',
      tone: 'pratico',
    })
  })

  it('usa manifest sem paths explícitos e ignora o arquivo do manifest como conteúdo', async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'rag-manifest-'))
    tempDirectories.push(cwd)

    const markdownPath = path.join(cwd, 'docs', 'aula-1.md')
    const manifestPath = path.join(cwd, 'rag-manifest.json')

    await mkdir(path.dirname(markdownPath), { recursive: true })
    await writeFile(markdownPath, '# Aula 1\n\nTexto da aula 1.', 'utf8')
    await writeFile(
      manifestPath,
      JSON.stringify({
        defaults: {
          metadata: { author: 'Isabela' },
          chunkMetadata: { channel: 'curso' },
        },
        documents: [
          {
            path: 'docs/aula-1.md',
            title: 'Aula 1 Curada',
            sourceType: 'manual',
            metadata: { tags: ['aula'] },
          },
        ],
      }),
      'utf8',
    )

    const indexed: Array<{
      title: string
      sourceType: string
      sourceUrl?: string
      metadata?: Record<string, unknown>
      chunks: Array<{ content: string; metadata?: Record<string, unknown> }>
    }> = []
    const deletedSourceUrls: string[] = []

    const summary = await ingestRagSources({
      inputs: [],
      options: {
        cwd,
        manifestPath: 'rag-manifest.json',
        replaceExisting: true,
      },
      rag: {
        async search() {
          return []
        },
        formatForContext() {
          return ''
        },
        async indexDocument(params: {
          title: string
          sourceType: 'pdf' | 'transcript' | 'article' | 'manual'
          sourceUrl?: string
          metadata?: Record<string, unknown>
          chunks: Array<{ content: string; metadata?: Record<string, unknown> }>
        }) {
          indexed.push(params)
          return 'doc-1'
        },
      } as never,
      supabase: {
        from() {
          return {
            select() {
              return {
                eq() {
                  return Promise.resolve({ data: [], error: null })
                },
              }
            },
            delete() {
              return {
                in(_column: string, ids: string[]) {
                  deletedSourceUrls.push(...ids)
                  return Promise.resolve({ error: null })
                },
              }
            },
          }
        },
      } as never,
      logger: {
        info() {},
        warn() {},
      } as never,
    })

    expect(summary.filesDiscovered).toBe(1)
    expect(summary.filesIndexed).toBe(1)
    expect(indexed).toHaveLength(1)
    expect(indexed[0]).toMatchObject({
      title: 'Aula 1 Curada',
      sourceType: 'manual',
      metadata: {
        author: 'Isabela',
        tags: ['aula'],
        sourcePath: 'docs/aula-1.md',
      },
    })
    expect(indexed[0]?.chunks[0]?.metadata).toMatchObject({ channel: 'curso' })
    expect(deletedSourceUrls).toHaveLength(0)
  })

  it('pula reingestão quando o mesmo conteúdo já existe para o source_url', async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'rag-ingestion-skip-'))
    tempDirectories.push(cwd)

    const markdownPath = path.join(cwd, 'docs', 'aula-2.md')
    await mkdir(path.dirname(markdownPath), { recursive: true })
    await writeFile(markdownPath, '# Aula 2\n\nTexto estável da aula 2.', 'utf8')

    const prepared = await prepareDocument(markdownPath, { cwd })
    let indexedCalls = 0
    let deleteCalls = 0

    const summary = await ingestRagSources({
      inputs: ['docs'],
      options: { cwd },
      rag: {
        async indexDocument() {
          indexedCalls += 1
          return 'doc-2'
        },
      } as never,
      supabase: {
        from() {
          return {
            select() {
              return {
                eq() {
                  return Promise.resolve({
                    data: [
                      {
                        id: 'existing-doc',
                        source_url: prepared.sourceUrl,
                        metadata: prepared.metadata,
                      },
                    ],
                    error: null,
                  })
                },
              }
            },
            delete() {
              return {
                in() {
                  deleteCalls += 1
                  return Promise.resolve({ error: null })
                },
              }
            },
          }
        },
      } as never,
      logger: {
        info() {},
        warn() {},
      } as never,
    })

    expect(summary.filesIndexed).toBe(0)
    expect(summary.filesSkipped).toBe(1)
    expect(summary.filesUnchanged).toBe(1)
    expect(summary.filesConflicted).toBe(0)
    expect(indexedCalls).toBe(0)
    expect(deleteCalls).toBe(0)
  })

  it('marca conflito quando source_url já existe com conteúdo diferente sem --replace', async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'rag-ingestion-conflict-'))
    tempDirectories.push(cwd)

    const markdownPath = path.join(cwd, 'docs', 'aula-3.md')
    await mkdir(path.dirname(markdownPath), { recursive: true })
    await writeFile(markdownPath, '# Aula 3\n\nTexto novo da aula 3.', 'utf8')

    let indexedCalls = 0

    const summary = await ingestRagSources({
      inputs: ['docs'],
      options: { cwd },
      rag: {
        async indexDocument() {
          indexedCalls += 1
          return 'doc-3'
        },
      } as never,
      supabase: {
        from() {
          return {
            select() {
              return {
                eq() {
                  return Promise.resolve({
                    data: [
                      {
                        id: 'existing-doc',
                        source_url: 'docs/aula-3.md',
                        metadata: {
                          contentHash: 'hash-antigo',
                          chunking: { size: 1200, overlap: 200 },
                        },
                      },
                    ],
                    error: null,
                  })
                },
              }
            },
            delete() {
              return {
                in() {
                  return Promise.resolve({ error: null })
                },
              }
            },
          }
        },
      } as never,
      logger: {
        info() {},
        warn() {},
      } as never,
    })

    expect(summary.filesIndexed).toBe(0)
    expect(summary.filesSkipped).toBe(1)
    expect(summary.filesUnchanged).toBe(0)
    expect(summary.filesConflicted).toBe(1)
    expect(indexedCalls).toBe(0)
  })
})
