import { OpenAIEmbeddingAdapter, RAGService } from '@perpetuo/ai-gateway'
import { createSupabaseClient } from '@perpetuo/database'
import pino from 'pino'
import { ingestRagSources, parseIngestionArgs } from './rag-ingestion.js'

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
})

function printUsage(): void {
  console.log(`Uso:
  pnpm --filter @perpetuo/worker ingest:rag -- <arquivo-ou-pasta> [...outros] [--manifest rag-manifest.json] [--replace] [--dry-run]
  pnpm --filter @perpetuo/worker ingest:rag -- --manifest rag-manifest.json [--replace] [--dry-run]

Flags:
  --manifest <arquivo>   aplica overrides de title/source_type/source_url/metadata por documento
  --replace              remove documentos já indexados com o mesmo source_url antes de reingerir
  --dry-run              prepara e chunka sem escrever no Supabase
  --chunk-size <n>       tamanho alvo por chunk em caracteres (padrão: 1200)
  --chunk-overlap <n>    overlap entre chunks em caracteres (padrão: 200)
  --source-url-prefix    prefixo opcional para source_url salvo no banco
  --help                 mostra esta ajuda

Extensões suportadas:
  .md, .txt, .json, .pdf

Env necessário:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY (preferido) ou SUPABASE_ANON_KEY
  OPENAI_API_KEY

Obs:
  PDFs usam o binário 'pdftotext'.`)
}

async function main() {
  const { paths, options, help } = parseIngestionArgs(process.argv.slice(2))

  if (help || (paths.length === 0 && !options.manifestPath)) {
    printUsage()
    return
  }

  const supabase = createSupabaseClient()
  const rag = new RAGService({
    supabase,
    embeddingProvider: new OpenAIEmbeddingAdapter(),
  })

  const summary = await ingestRagSources({
    inputs: paths,
    rag,
    supabase,
    logger,
    options,
  })

  logger.info({ summary }, 'RAG ingestion completed')
}

main().catch((error) => {
  logger.error({ error }, 'RAG ingestion failed')
  process.exit(1)
})
