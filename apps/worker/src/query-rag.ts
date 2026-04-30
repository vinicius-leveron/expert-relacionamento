import { OpenAIEmbeddingAdapter, RAGService } from '@perpetuo/ai-gateway'
import { createSupabaseClient } from '@perpetuo/database'
import pino from 'pino'
import {
  formatIndexedDocuments,
  formatSearchResults,
  listIndexedDocuments,
  parseRagQueryArgs,
  searchIndexedKnowledge,
} from './rag-query.js'

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
})

function printUsage(): void {
  console.log(`Uso:
  pnpm --filter @perpetuo/worker query:rag -- "como responder a esse sumiço?"
  pnpm --filter @perpetuo/worker query:rag -- --list-docs
  pnpm --filter @perpetuo/worker query:rag -- --list-docs --source-type transcript --limit 10
  pnpm --filter @perpetuo/worker query:rag -- "abertura de conversa" --count 8 --threshold 0.65

Flags:
  --list-docs            lista documentos já indexados no knowledge base
  --count <n>            quantidade de chunks retornados na busca semântica (padrão: 5)
  --threshold <0-1>      limiar mínimo de similaridade (padrão: 0.7)
  --limit <n>            limite para listagem de documentos (padrão: 20)
  --source-type <tipo>   filtra por pdf, transcript, article ou manual
  --json                 imprime saída em JSON
  --help                 mostra esta ajuda

Env necessário:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY (preferido) ou SUPABASE_ANON_KEY
  OPENAI_API_KEY para buscas semânticas

Obs:
  --list-docs não precisa de OPENAI_API_KEY.`)
}

async function main() {
  const { query, options, help } = parseRagQueryArgs(process.argv.slice(2))

  if (help || (!options.listDocuments && !query)) {
    printUsage()
    return
  }

  const supabase = createSupabaseClient()

  if (options.listDocuments) {
    const documents = await listIndexedDocuments({
      supabase,
      limit: options.limit,
      sourceType: options.sourceType,
    })

    if (options.json) {
      console.log(JSON.stringify(documents, null, 2))
      return
    }

    console.log(formatIndexedDocuments(documents))
    return
  }

  const rag = new RAGService({
    supabase,
    embeddingProvider: new OpenAIEmbeddingAdapter(),
  })

  const results = await searchIndexedKnowledge({
    rag,
    supabase,
    query: query!,
    options,
  })

  if (options.json) {
    console.log(JSON.stringify(results, null, 2))
    return
  }

  console.log(formatSearchResults(results))
}

main().catch((error) => {
  logger.error({ error }, 'RAG query failed')
  process.exit(1)
})
