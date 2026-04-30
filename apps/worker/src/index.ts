import { AnthropicAdapter, MockAIAdapter, OpenAIEmbeddingAdapter } from '@perpetuo/ai-gateway'
import type { AIProviderPort, ChannelPort } from '@perpetuo/core'
import {
  SupabaseAttachmentRepository,
  SupabaseConversationRepository,
  SupabaseDiagnosticRepository,
  SupabaseUserRepository,
  createSupabaseClient,
} from '@perpetuo/database'
import pino from 'pino'
import { MockChannelAdapter, UazapiAdapter } from '@perpetuo/whatsapp-adapter'
import { AttachmentWorker } from './attachment-worker.js'
import { JourneyWorker } from './journey-worker.js'

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
})

async function createAIProvider(): Promise<AIProviderPort> {
  if (process.env.ANTHROPIC_API_KEY) {
    return new AnthropicAdapter()
  }

  logger.warn('ANTHROPIC_API_KEY not set, worker will use fallback/static journey messages')
  return new MockAIAdapter()
}

async function createChannelAdapter(): Promise<ChannelPort> {
  if (
    process.env.WHATSAPP_PROVIDER?.toLowerCase() === 'uazapi' &&
    process.env.UAZAPI_SUBDOMAIN &&
    process.env.UAZAPI_INSTANCE_TOKEN
  ) {
    return new UazapiAdapter({
      subdomain: process.env.UAZAPI_SUBDOMAIN,
      instanceToken: process.env.UAZAPI_INSTANCE_TOKEN,
      webhookSignature: process.env.UAZAPI_WEBHOOK_SIGNATURE,
    })
  }

  logger.warn('WhatsApp provider not configured, worker will use mock channel adapter')
  return new MockChannelAdapter()
}

async function main() {
  const supabase = createSupabaseClient()
  const aiProvider = await createAIProvider()
  const channel = await createChannelAdapter()
  const attachmentRepo = new SupabaseAttachmentRepository(supabase)

  const journeyWorker = new JourneyWorker(
    {
      channel,
      aiProvider,
      userRepo: new SupabaseUserRepository(supabase),
      conversationRepo: new SupabaseConversationRepository(supabase),
      diagnosticRepo: new SupabaseDiagnosticRepository(supabase),
      logger,
    },
    {
      maxJourneysPerCycle: Number(process.env.WORKER_MAX_JOURNEYS_PER_CYCLE ?? 25),
      reengagementAfterDays: Number(process.env.WORKER_REENGAGEMENT_AFTER_DAYS ?? 3),
    },
  )

  const attachmentWorker = process.env.OPENAI_API_KEY
    ? new AttachmentWorker(
        {
          supabase,
          attachmentRepo,
          embeddingProvider: new OpenAIEmbeddingAdapter(),
          logger,
        },
        {
          maxJobsPerCycle: Number(process.env.WORKER_MAX_ATTACHMENT_JOBS_PER_CYCLE ?? 10),
          chunkSize: Number(process.env.WORKER_ATTACHMENT_CHUNK_SIZE ?? 1200),
          chunkOverlap: Number(process.env.WORKER_ATTACHMENT_CHUNK_OVERLAP ?? 200),
        },
      )
    : null

  if (!attachmentWorker) {
    logger.warn('OPENAI_API_KEY not set, attachment ingestion worker is disabled')
  }

  const intervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 60_000)
  let running = false

  const runCycle = async () => {
    if (running) {
      logger.warn('Skipping worker cycle because the previous one is still running')
      return
    }

    running = true
    try {
      const attachmentStats = attachmentWorker
        ? await attachmentWorker.runCycle().catch((error) => {
            logger.error({ error }, 'Attachment worker cycle failed')
            return null
          })
        : null
      const journeyStats = await journeyWorker.runCycle()
      logger.info({ attachmentStats, journeyStats }, 'Worker cycle completed')
    } catch (error) {
      logger.error({ error }, 'Worker cycle failed')
    } finally {
      running = false
    }
  }

  logger.info({ intervalMs }, 'Worker started')

  await runCycle()
  setInterval(() => {
    void runCycle()
  }, intervalMs)
}

main().catch((err) => {
  logger.error(err, 'Worker failed to start')
  process.exit(1)
})
