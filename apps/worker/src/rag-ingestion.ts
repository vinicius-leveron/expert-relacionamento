import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import type { SupabaseClient } from '@perpetuo/database'
import type { Logger } from 'pino'

const execFileAsync = promisify(execFile)

const SUPPORTED_EXTENSIONS = new Set(['.md', '.txt', '.json', '.pdf'])
const TEXTUAL_SOURCE_EXTENSIONS = new Set(['.md', '.txt', '.json'])
const RESERVED_MANIFEST_FILENAMES = new Set(['rag-manifest.json'])

export interface ChunkingOptions {
  chunkSize: number
  chunkOverlap: number
}

export interface IngestionOptions extends ChunkingOptions {
  replaceExisting?: boolean
  dryRun?: boolean
  cwd?: string
  sourceUrlPrefix?: string
  manifestPath?: string
}

export interface IngestionManifestDocument {
  path: string
  title?: string
  sourceType?: 'pdf' | 'transcript' | 'article' | 'manual'
  sourceUrl?: string
  metadata?: Record<string, unknown>
  chunkMetadata?: Record<string, unknown>
  enabled?: boolean
}

export interface IngestionManifest {
  defaults?: {
    sourceType?: 'pdf' | 'transcript' | 'article' | 'manual'
    sourceUrlPrefix?: string
    metadata?: Record<string, unknown>
    chunkMetadata?: Record<string, unknown>
  }
  documents?: IngestionManifestDocument[]
}

export interface PreparedChunk {
  content: string
  metadata?: Record<string, unknown>
}

export interface PreparedDocument {
  filePath: string
  sourceUrl: string
  title: string
  sourceType: 'pdf' | 'transcript' | 'article' | 'manual'
  text: string
  metadata: Record<string, unknown>
  chunks: PreparedChunk[]
}

export interface IngestionSummary {
  filesDiscovered: number
  filesIndexed: number
  filesSkipped: number
  filesUnchanged: number
  filesConflicted: number
  replacedDocuments: number
  totalChunks: number
}

interface ResolvedManifestEntry {
  absolutePath: string
  relativePath: string
  config: IngestionManifestDocument
}

interface LoadedManifest {
  filePath: string
  defaults?: IngestionManifest['defaults']
  documents: Map<string, IngestionManifestDocument>
}

export interface RagIndexer {
  indexDocument(params: {
    title: string
    sourceType: 'pdf' | 'transcript' | 'article' | 'manual'
    sourceUrl?: string
    metadata?: Record<string, unknown>
    chunks: Array<{ content: string; metadata?: Record<string, unknown> }>
  }): Promise<string>
}

interface IndexedKnowledgeDocument {
  id: string
  sourceUrl?: string
  metadata: Record<string, unknown>
}

export function parseIngestionArgs(argv: string[]): {
  paths: string[]
  options: IngestionOptions
  help: boolean
} {
  const options: IngestionOptions = {
    chunkSize: 1200,
    chunkOverlap: 200,
    replaceExisting: false,
    dryRun: false,
  }
  const paths: string[] = []
  let help = false

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--help' || arg === '-h') {
      help = true
      continue
    }

    if (arg === '--replace') {
      options.replaceExisting = true
      continue
    }

    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }

    if (arg === '--chunk-size') {
      const value = Number(argv[index + 1])
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error('--chunk-size precisa ser um número positivo')
      }
      options.chunkSize = value
      index += 1
      continue
    }

    if (arg === '--chunk-overlap') {
      const value = Number(argv[index + 1])
      if (!Number.isFinite(value) || value < 0) {
        throw new Error('--chunk-overlap precisa ser um número maior ou igual a zero')
      }
      options.chunkOverlap = value
      index += 1
      continue
    }

    if (arg === '--source-url-prefix') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error('--source-url-prefix precisa de um valor')
      }
      options.sourceUrlPrefix = value
      index += 1
      continue
    }

    if (arg === '--manifest') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error('--manifest precisa de um caminho para o arquivo')
      }
      options.manifestPath = value
      index += 1
      continue
    }

    paths.push(arg)
  }

  if (options.chunkOverlap >= options.chunkSize) {
    throw new Error('--chunk-overlap precisa ser menor que --chunk-size')
  }

  return { paths, options, help }
}

export async function ingestRagSources(params: {
  inputs: string[]
  rag: RagIndexer
  supabase: SupabaseClient
  logger: Logger
  options?: Partial<IngestionOptions>
}): Promise<IngestionSummary> {
  const options = normalizeOptions(params.options)
  const cwd = options.cwd ?? process.cwd()
  const manifest = await loadIngestionManifest(options.manifestPath, cwd)
  const effectiveOptions = {
    ...options,
    cwd,
    sourceUrlPrefix: options.sourceUrlPrefix ?? manifest?.defaults?.sourceUrlPrefix,
  }
  const files = await resolveInputFiles(params.inputs, cwd, manifest)
  const summary: IngestionSummary = {
    filesDiscovered: files.length,
    filesIndexed: 0,
    filesSkipped: 0,
    filesUnchanged: 0,
    filesConflicted: 0,
    replacedDocuments: 0,
    totalChunks: 0,
  }

  for (const filePath of files) {
    const override = getManifestOverride(filePath, cwd, manifest)
    if (override?.enabled === false) {
      summary.filesSkipped += 1
      params.logger.info({ filePath }, 'Skipping disabled manifest document')
      continue
    }

    const prepared = await prepareDocument(filePath, effectiveOptions, override, manifest)
    if (prepared.chunks.length === 0) {
      summary.filesSkipped += 1
      params.logger.warn({ filePath }, 'Skipping file without chunkable text')
      continue
    }

    const existingDocuments = await findDocumentsBySourceUrl(params.supabase, prepared.sourceUrl)

    if (existingDocuments.length > 0 && !effectiveOptions.replaceExisting) {
      if (isUnchangedDocument(existingDocuments, prepared.metadata)) {
        summary.filesSkipped += 1
        summary.filesUnchanged += 1
        params.logger.info(
          { filePath, sourceUrl: prepared.sourceUrl },
          'Skipping document because the same content hash is already indexed',
        )
        continue
      }

      summary.filesSkipped += 1
      summary.filesConflicted += 1
      params.logger.warn(
        { filePath, sourceUrl: prepared.sourceUrl },
        'Skipping document because source_url already exists with different content; re-run with --replace to reindex',
      )
      continue
    }

    if (existingDocuments.length > 0 && effectiveOptions.replaceExisting) {
      const replaced = await deleteDocumentsByIds(
        params.supabase,
        existingDocuments.map((document) => document.id),
      )
      summary.replacedDocuments += replaced
      if (replaced > 0) {
        params.logger.info({ filePath, replaced }, 'Removed existing indexed documents')
      }
    }

    params.logger.info(
      {
        filePath,
        sourceType: prepared.sourceType,
        chunks: prepared.chunks.length,
        dryRun: effectiveOptions.dryRun,
      },
      'Prepared document for RAG ingestion',
    )

    summary.totalChunks += prepared.chunks.length

    if (effectiveOptions.dryRun) {
      continue
    }

    await params.rag.indexDocument({
      title: prepared.title,
      sourceType: prepared.sourceType,
      sourceUrl: prepared.sourceUrl,
      metadata: prepared.metadata,
      chunks: prepared.chunks,
    })

    summary.filesIndexed += 1
  }

  return summary
}

export async function prepareDocument(
  filePath: string,
  options?: Partial<IngestionOptions>,
  override?: IngestionManifestDocument,
  manifest?: LoadedManifest | null,
): Promise<PreparedDocument> {
  const normalizedOptions = normalizeOptions(options)
  const cwd = normalizedOptions.cwd ?? process.cwd()
  const absolutePath = path.resolve(cwd, filePath)
  const extension = path.extname(absolutePath).toLowerCase()

  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error(`Unsupported file type: ${extension}`)
  }

  const text =
    extension === '.pdf'
      ? await extractPdfText(absolutePath)
      : await extractTextualFile(absolutePath, extension)

  const normalizedText = normalizeWhitespace(text)
  const relativePath = normalizeRelativePath(path.relative(cwd, absolutePath))
  const contentHash = createContentHash(normalizedText)
  const sourceType =
    override?.sourceType ?? manifest?.defaults?.sourceType ?? inferSourceType(absolutePath)
  const sourceUrl =
    override?.sourceUrl ??
    buildSourceUrl(absolutePath, cwd, normalizedOptions.sourceUrlPrefix)
  const title = override?.title ?? buildTitleFromPath(absolutePath)
  const baseChunkMetadata = {
    ...(manifest?.defaults?.chunkMetadata ?? {}),
    ...(override?.chunkMetadata ?? {}),
  }
  const chunks = chunkDocument(
    normalizedText,
    {
      chunkSize: normalizedOptions.chunkSize,
      chunkOverlap: normalizedOptions.chunkOverlap,
    },
    baseChunkMetadata,
  )
  const metadata = {
    ...(manifest?.defaults?.metadata ?? {}),
    ...(override?.metadata ?? {}),
    sourcePath: relativePath,
    contentHash,
    contentLength: normalizedText.length,
    chunking: {
      size: normalizedOptions.chunkSize,
      overlap: normalizedOptions.chunkOverlap,
    },
  }

  return {
    filePath: absolutePath,
    sourceUrl,
    title,
    sourceType,
    text: normalizedText,
    metadata,
    chunks,
  }
}

export async function collectSupportedFiles(
  inputs: string[],
  cwd = process.cwd(),
  ignoredAbsolutePaths: string[] = [],
): Promise<string[]> {
  const discovered = new Set<string>()
  const ignoredSet = new Set(ignoredAbsolutePaths.map((value) => path.resolve(value)))

  for (const input of inputs) {
    const resolved = path.resolve(cwd, input)
    const stat = await fs.stat(resolved)

    if (stat.isDirectory()) {
      const nestedFiles = await walkDirectory(resolved)
      for (const filePath of nestedFiles) {
        if (
          SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase()) &&
          !ignoredSet.has(filePath) &&
          !RESERVED_MANIFEST_FILENAMES.has(path.basename(filePath))
        ) {
          discovered.add(filePath)
        }
      }
      continue
    }

    if (
      stat.isFile() &&
      SUPPORTED_EXTENSIONS.has(path.extname(resolved).toLowerCase()) &&
      !ignoredSet.has(resolved) &&
      !RESERVED_MANIFEST_FILENAMES.has(path.basename(resolved))
    ) {
      discovered.add(resolved)
    }
  }

  return [...discovered].sort()
}

export function chunkDocument(
  text: string,
  options: ChunkingOptions,
  baseChunkMetadata: Record<string, unknown> = {},
): PreparedChunk[] {
  if (!text.trim()) {
    return []
  }

  const sections = splitIntoSections(text)
  const chunks: PreparedChunk[] = []

  for (const section of sections) {
    const sectionPrefix = section.heading ? `${section.heading}\n\n` : ''
    const sectionText = `${sectionPrefix}${section.content}`.trim()
    if (!sectionText) {
      continue
    }

    if (sectionText.length <= options.chunkSize) {
      chunks.push({
        content: sectionText,
        metadata: {
          ...baseChunkMetadata,
          ...(section.heading ? { sectionTitle: section.heading } : {}),
        },
      })
      continue
    }

    const windows = createOverlappingWindows(sectionText, options)
    for (const window of windows) {
      chunks.push({
        content: window.trim(),
        metadata: {
          ...baseChunkMetadata,
          ...(section.heading ? { sectionTitle: section.heading } : {}),
        },
      })
    }
  }

  return chunks.map((chunk, index) => ({
    content: chunk.content,
    metadata: {
      ...(chunk.metadata ?? {}),
      chunkIndex: index,
    },
  }))
}

export function inferSourceType(filePath: string): 'pdf' | 'transcript' | 'article' | 'manual' {
  const extension = path.extname(filePath).toLowerCase()
  const normalizedName = path.basename(filePath).toLowerCase()

  if (extension === '.pdf') {
    return 'pdf'
  }

  if (
    normalizedName.includes('transcript') ||
    normalizedName.includes('meeting') ||
    normalizedName.includes('call') ||
    normalizedName.includes('audio') ||
    normalizedName.includes('podcast')
  ) {
    return 'transcript'
  }

  if (
    normalizedName.includes('manual') ||
    normalizedName.includes('guide') ||
    normalizedName.includes('playbook') ||
    normalizedName.includes('faq')
  ) {
    return 'manual'
  }

  return 'article'
}

export function extractTextFromJson(value: unknown): string {
  const lines: string[] = []
  walkJsonText(value, lines)
  return normalizeWhitespace(lines.join('\n\n'))
}

async function findDocumentsBySourceUrl(
  supabase: SupabaseClient,
  sourceUrl: string,
): Promise<IndexedKnowledgeDocument[]> {
  const { data, error } = await supabase
    .from('knowledge_documents')
    .select('id, source_url, metadata')
    .eq('source_url', sourceUrl)

  if (error) {
    throw new Error(`Failed to query existing knowledge documents: ${error.message}`)
  }

  return (data ?? []).map((document) => ({
    id: document.id,
    sourceUrl: document.source_url ?? undefined,
    metadata: asMetadataRecord(document.metadata),
  }))
}

async function deleteDocumentsByIds(
  supabase: SupabaseClient,
  documentIds: string[],
): Promise<number> {
  if (documentIds.length === 0) {
    return 0
  }

  const { error: deleteError } = await supabase
    .from('knowledge_documents')
    .delete()
    .in('id', documentIds)

  if (deleteError) {
    throw new Error(`Failed to delete existing knowledge documents: ${deleteError.message}`)
  }

  return documentIds.length
}

async function loadIngestionManifest(
  manifestPath: string | undefined,
  cwd: string,
): Promise<LoadedManifest | null> {
  if (!manifestPath) {
    return null
  }

  const resolvedManifestPath = path.resolve(cwd, manifestPath)
  const raw = await fs.readFile(resolvedManifestPath, 'utf8')
  const parsed = JSON.parse(raw) as IngestionManifest
  const documents = new Map<string, IngestionManifestDocument>()

  for (const entry of resolveManifestEntries(parsed, cwd)) {
    documents.set(entry.relativePath, entry.config)
  }

  return {
    filePath: resolvedManifestPath,
    defaults: parsed.defaults,
    documents,
  }
}

function resolveManifestEntries(
  manifest: IngestionManifest,
  cwd: string,
): ResolvedManifestEntry[] {
  return (manifest.documents ?? [])
    .filter((document) => document.path)
    .map((document) => {
      const absolutePath = path.resolve(cwd, document.path)
      return {
        absolutePath,
        relativePath: normalizeRelativePath(path.relative(cwd, absolutePath)),
        config: document,
      }
    })
}

async function resolveInputFiles(
  inputs: string[],
  cwd: string,
  manifest: LoadedManifest | null,
): Promise<string[]> {
  if (inputs.length > 0) {
    return collectSupportedFiles(inputs, cwd, manifest ? [manifest.filePath] : [])
  }

  if (!manifest || manifest.documents.size === 0) {
    return []
  }

  return [...manifest.documents.keys()].map((relativePath) => path.resolve(cwd, relativePath)).sort()
}

function getManifestOverride(
  filePath: string,
  cwd: string,
  manifest: LoadedManifest | null,
): IngestionManifestDocument | undefined {
  if (!manifest) {
    return undefined
  }

  return manifest.documents.get(normalizeRelativePath(path.relative(cwd, path.resolve(filePath))))
}

async function extractTextualFile(filePath: string, extension: string): Promise<string> {
  const raw = await fs.readFile(filePath, 'utf8')
  if (extension === '.json') {
    return extractTextFromJson(JSON.parse(raw))
  }
  if (TEXTUAL_SOURCE_EXTENSIONS.has(extension)) {
    return raw
  }
  throw new Error(`Unsupported textual extension: ${extension}`)
}

async function extractPdfText(filePath: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('pdftotext', ['-layout', '-enc', 'UTF-8', filePath, '-'])
    return stdout
  } catch (error) {
    throw new Error(
      `Failed to extract PDF text from ${filePath}. Instale 'pdftotext' no ambiente para ingerir PDFs. ${formatError(error)}`,
    )
  }
}

async function walkDirectory(directoryPath: string): Promise<string[]> {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const resolved = path.join(directoryPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkDirectory(resolved)))
      continue
    }
    if (entry.isFile()) {
      files.push(resolved)
    }
  }

  return files
}

function splitIntoSections(text: string): Array<{ heading?: string; content: string }> {
  const lines = text.split('\n')
  const sections: Array<{ heading?: string; content: string }> = []

  let currentHeading: string | undefined
  let buffer: string[] = []

  const pushSection = () => {
    const content = normalizeWhitespace(buffer.join('\n'))
    if (!content) {
      buffer = []
      return
    }
    sections.push({ heading: currentHeading, content })
    buffer = []
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (/^#{1,6}\s+/.test(trimmed)) {
      pushSection()
      currentHeading = trimmed.replace(/^#{1,6}\s+/, '').trim()
      continue
    }
    buffer.push(line)
  }

  pushSection()

  if (sections.length === 0) {
    return [{ content: normalizeWhitespace(text) }]
  }

  return sections
}

function createOverlappingWindows(text: string, options: ChunkingOptions): string[] {
  const windows: string[] = []
  let start = 0

  while (start < text.length) {
    const tentativeEnd = Math.min(start + options.chunkSize, text.length)
    let end = tentativeEnd

    if (tentativeEnd < text.length) {
      const preferredBreak = text.lastIndexOf('\n\n', tentativeEnd)
      if (preferredBreak > start + Math.floor(options.chunkSize * 0.6)) {
        end = preferredBreak
      }
    }

    const chunk = text.slice(start, end).trim()
    if (chunk) {
      windows.push(chunk)
    }

    if (end >= text.length) {
      break
    }

    start = Math.max(end - options.chunkOverlap, start + 1)
  }

  return windows
}

function walkJsonText(value: unknown, lines: string[]): void {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed) {
      lines.push(trimmed)
    }
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      walkJsonText(item, lines)
    }
    return
  }

  if (!value || typeof value !== 'object') {
    return
  }

  const record = value as Record<string, unknown>
  if (typeof record.speaker === 'string' && typeof record.text === 'string') {
    lines.push(`${record.speaker}: ${record.text}`)
    return
  }

  for (const [key, nested] of Object.entries(record)) {
    if (typeof nested === 'string') {
      const trimmed = nested.trim()
      if (!trimmed) {
        continue
      }

      if (['title', 'heading', 'section', 'topic'].includes(key)) {
        lines.push(`# ${trimmed}`)
      } else if (
        ['text', 'content', 'transcript', 'body', 'description', 'summary', 'message'].includes(key)
      ) {
        lines.push(trimmed)
      }
      continue
    }

    walkJsonText(nested, lines)
  }
}

function buildSourceUrl(filePath: string, cwd: string, sourceUrlPrefix?: string): string {
  const relativePath = normalizeRelativePath(path.relative(cwd, filePath))
  if (!sourceUrlPrefix) {
    return relativePath
  }

  return `${sourceUrlPrefix.replace(/\/+$/, '')}/${relativePath}`
}

function buildTitleFromPath(filePath: string): string {
  const basename = path.basename(filePath, path.extname(filePath))
  return basename.replace(/[-_]+/g, ' ').trim()
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeOptions(options?: Partial<IngestionOptions>): IngestionOptions {
  return {
    chunkSize: options?.chunkSize ?? 1200,
    chunkOverlap: options?.chunkOverlap ?? 200,
    replaceExisting: options?.replaceExisting ?? false,
    dryRun: options?.dryRun ?? false,
    cwd: options?.cwd ?? process.cwd(),
    sourceUrlPrefix: options?.sourceUrlPrefix,
    manifestPath: options?.manifestPath,
  }
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.split(path.sep).join('/')
}

function createContentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

function isUnchangedDocument(
  documents: IndexedKnowledgeDocument[],
  preparedMetadata: Record<string, unknown>,
): boolean {
  const preparedHash = getStringMetadataValue(preparedMetadata, 'contentHash')
  const preparedChunking = getChunkingMetadata(preparedMetadata)

  return documents.some((document) => {
    const existingHash = getStringMetadataValue(document.metadata, 'contentHash')
    if (!preparedHash || !existingHash || existingHash !== preparedHash) {
      return false
    }

    const existingChunking = getChunkingMetadata(document.metadata)
    return (
      existingChunking?.size === preparedChunking?.size &&
      existingChunking?.overlap === preparedChunking?.overlap
    )
  })
}

function getChunkingMetadata(
  metadata: Record<string, unknown>,
): { size?: number; overlap?: number } | undefined {
  const value = metadata.chunking
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const record = value as Record<string, unknown>
  return {
    size: typeof record.size === 'number' ? record.size : undefined,
    overlap: typeof record.overlap === 'number' ? record.overlap : undefined,
  }
}

function getStringMetadataValue(
  metadata: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = metadata[key]
  return typeof value === 'string' ? value : undefined
}

function asMetadataRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}
