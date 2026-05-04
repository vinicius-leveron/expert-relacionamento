import { config } from 'dotenv'
import { resolve } from 'node:path'

// Carrega .env da raiz do monorepo
config({ path: resolve(process.cwd(), '../../.env') })
import { serve } from '@hono/node-server'
import type { AIProviderPort, UserRepository } from '@perpetuo/core'
import { JwtService, MagicLinkService, VerificationCodeService } from '@perpetuo/core'
import type { SupabaseClient } from '@perpetuo/database'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import pino from 'pino'

import { MessageEmitter } from './events/message-emitter.js'
import { MessagePipeline } from './pipeline/index.js'
import { apiRateLimit, webhookRateLimit } from './middleware/index.js'
import {
  createApiRoutes,
  createHealthRoute,
  createPaymentWebhookRoute,
  createWhatsAppWebhookRoute,
} from './routes/index.js'
import {
  ChatAttachmentStorageService,
  createEmailSender,
  isEmailDeliveryConfigured,
} from './services/index.js'

// Imports condicionais para evitar erro se env vars não existirem em dev
const createPersistence = async () => {
  const {
    SupabaseAttachmentRepository,
    SupabaseAvatarProfileRepository,
    createSupabaseClient,
    SupabaseConversationRepository,
    SupabaseDiagnosticRepository,
    SupabaseSubscriptionRepository,
    SupabaseUserRepository,
  } = await import('@perpetuo/database')
  const supabase = createSupabaseClient()
  return {
    supabase,
    attachmentRepo: new SupabaseAttachmentRepository(supabase),
    avatarProfileRepo: new SupabaseAvatarProfileRepository(supabase),
    userRepo: new SupabaseUserRepository(supabase),
    conversationRepo: new SupabaseConversationRepository(supabase),
    diagnosticRepo: new SupabaseDiagnosticRepository(supabase),
    subscriptionRepo: new SupabaseSubscriptionRepository(supabase),
  }
}

const createAIProvider = async (): Promise<AIProviderPort> => {
  // Se tem API key, usa Anthropic real
  if (process.env.ANTHROPIC_API_KEY) {
    const { AnthropicAdapter } = await import('@perpetuo/ai-gateway')
    return new AnthropicAdapter()
  }
  // Senão, usa mock
  const { MockAIAdapter } = await import('@perpetuo/ai-gateway')
  return new MockAIAdapter()
}

const createOptionalRAG = async (supabase: SupabaseClient) => {
  if (!process.env.OPENAI_API_KEY) {
    return undefined
  }

  const { OpenAIEmbeddingAdapter, RAGService } = await import('@perpetuo/ai-gateway')
  return new RAGService({
    supabase,
    embeddingProvider: new OpenAIEmbeddingAdapter(),
  })
}

const createOptionalAttachmentRAG = async (supabase: SupabaseClient) => {
  if (!process.env.OPENAI_API_KEY) {
    return undefined
  }

  const { AttachmentRAGService, OpenAIEmbeddingAdapter } = await import('@perpetuo/ai-gateway')
  return new AttachmentRAGService({
    supabase,
    embeddingProvider: new OpenAIEmbeddingAdapter(),
  })
}

const createOptionalTranscriber = async () => {
  if (!process.env.OPENAI_API_KEY) {
    return undefined
  }

  const { WhisperAdapter } = await import('@perpetuo/ai-gateway')
  const adapter = new WhisperAdapter()
  return {
    transcribe: async (audioUrl: string) => {
      const result = await adapter.transcribe(audioUrl)
      return result.text
    },
  }
}

const createChannelAdapter = async () => {
  if (
    process.env.WHATSAPP_PROVIDER?.toLowerCase() === 'uazapi' &&
    process.env.UAZAPI_SUBDOMAIN &&
    process.env.UAZAPI_INSTANCE_TOKEN
  ) {
    const { UazapiAdapter } = await import('@perpetuo/whatsapp-adapter')
    return new UazapiAdapter({
      subdomain: process.env.UAZAPI_SUBDOMAIN,
      instanceToken: process.env.UAZAPI_INSTANCE_TOKEN,
      webhookSignature: process.env.UAZAPI_WEBHOOK_SIGNATURE,
    })
  }

  const { MockChannelAdapter } = await import('@perpetuo/whatsapp-adapter')
  return new MockChannelAdapter()
}

const createPaymentAdapter = async () => {
  if (
    process.env.PAYMENT_PROVIDER?.toLowerCase() === 'hubla' &&
    process.env.HUBLA_WEBHOOK_TOKEN
  ) {
    const { HublaPaymentAdapter } = await import('@perpetuo/payment-gateway')
    return new HublaPaymentAdapter({
      webhookToken: process.env.HUBLA_WEBHOOK_TOKEN,
    })
  }

  return undefined
}

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
})

// JWT secret - usa env var ou gera um para desenvolvimento
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production-' + Math.random()
if (!process.env.JWT_SECRET) {
  logger.warn('JWT_SECRET not set, using random dev secret (sessions will be lost on restart)')
}

const WEB_APP_URL = process.env.WEB_APP_URL

// App base URL para magic links
const APP_BASE_URL = WEB_APP_URL ?? process.env.APP_BASE_URL ?? 'http://localhost:8081'
const NATIVE_CHECKOUT_MODE =
  process.env.NATIVE_CHECKOUT_MODE === 'blocked' ? 'blocked' : 'external_link'

const allowedOrigins = new Set(
  [
    'http://localhost:8081',
    'http://127.0.0.1:8081',
    'http://localhost:8082',
    'http://127.0.0.1:8082',
    'http://localhost:19006',
    'http://127.0.0.1:19006',
    'exp://localhost:8081',
    'exp://127.0.0.1:8081',
    'https://perpetuo-api-fdrf.onrender.com',
    WEB_APP_URL,
  ].filter(Boolean) as string[]
)

const isAllowedWebOrigin = (origin: string) =>
  /^https:\/\/expert-relacionamento(?:-[a-z0-9-]+)*\.vercel\.app$/.test(origin)

async function main() {
  let userRepo: UserRepository
  let conversationRepo
  let diagnosticRepo
  let subscriptionRepo
  let attachmentRepo
  let avatarProfileRepo
  let attachmentStorage
  let sessionRepo
  let magicLinkRepo
  let verificationCodeRepo
  let rag
  let attachmentRag
  try {
    const persistence = await createPersistence()
    userRepo = persistence.userRepo
    conversationRepo = persistence.conversationRepo
    diagnosticRepo = persistence.diagnosticRepo
    subscriptionRepo = persistence.subscriptionRepo
    attachmentRepo = persistence.attachmentRepo
    avatarProfileRepo = persistence.avatarProfileRepo
    attachmentStorage = new ChatAttachmentStorageService(persistence.supabase)
    rag = await createOptionalRAG(persistence.supabase)
    attachmentRag = await createOptionalAttachmentRAG(persistence.supabase)

    // Auth repositories
    const {
      SupabaseSessionRepository,
      SupabaseMagicLinkRepository,
      SupabaseVerificationCodeRepository,
    } = await import('@perpetuo/database')
    sessionRepo = new SupabaseSessionRepository(persistence.supabase)
    magicLinkRepo = new SupabaseMagicLinkRepository(persistence.supabase)
    verificationCodeRepo = new SupabaseVerificationCodeRepository(persistence.supabase)
  } catch {
    // Fallback para mock em desenvolvimento sem Supabase.
    logger.warn('Supabase not configured, using in-memory mock repository and disabling persistence')
    const { createMockUserRepository } = await import('./repositories/mock-user.repository.js')
    userRepo = createMockUserRepository()
  }

  const transcriber = await createOptionalTranscriber()
  const paymentAdapter = await createPaymentAdapter()
  const emailDeliveryConfigured = isEmailDeliveryConfigured()
  const publicUrlsConfigured = Boolean(WEB_APP_URL?.trim() && APP_BASE_URL?.trim())
  const paymentConfigured = Boolean(
    process.env.PAYMENT_URL?.trim() && paymentAdapter && subscriptionRepo,
  )
  const storageConfigured = Boolean(attachmentRepo && attachmentStorage)
  const aiConfigured = Boolean(
    process.env.ANTHROPIC_API_KEY?.trim() && process.env.OPENAI_API_KEY?.trim(),
  )
  const healthRoute = createHealthRoute({
    checks: {
      database: Boolean(
        conversationRepo &&
          diagnosticRepo &&
          subscriptionRepo &&
          userRepo &&
          avatarProfileRepo,
      ),
      email: emailDeliveryConfigured,
      payment: paymentConfigured,
      storage: storageConfigured,
      ai: aiConfigured,
      publicUrls: publicUrlsConfigured,
    },
  })

  // AI Provider (real ou mock baseado em env)
  const aiProvider = await createAIProvider()
  if (aiProvider.providerName === 'mock') {
    logger.warn('ANTHROPIC_API_KEY not set, using mock AI provider')
  } else {
    logger.info(`Using ${aiProvider.providerName} AI provider`)
  }

  const channelAdapter = await createChannelAdapter()

  const pipeline = new MessagePipeline({
    channel: channelAdapter,
    userRepo,
    aiProvider,
    logger,
    conversationRepo,
    attachmentRepo,
    avatarProfileRepo,
    diagnosticRepo,
    subscriptionRepo,
    rag,
    attachmentRag,
    transcriber,
    inlineImageStorage: attachmentStorage,
    paymentUrl: process.env.PAYMENT_URL,
  })

  const app = new Hono()

  // Middleware
  app.use('*', honoLogger())

  // CORS para o app mobile/web
  app.use(
    '/api/*',
    cors({
      origin: (origin) => {
        if (allowedOrigins.has(origin) || isAllowedWebOrigin(origin)) {
          return origin
        }

        return null
      },
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    }),
  )

  // Rate limiting
  app.use('/api/*', apiRateLimit)
  app.use('/webhook/*', webhookRateLimit)

  // Routes
  app.route('/health', healthRoute)
  app.route('/webhook/whatsapp', createWhatsAppWebhookRoute(pipeline))
  app.route(
    '/webhook/payment',
    createPaymentWebhookRoute({
      paymentAdapter,
      userRepo,
      subscriptionRepo,
      logger,
    }),
  )

  // API REST para o app (se auth configurado)
  if (sessionRepo && magicLinkRepo && verificationCodeRepo) {
    const jwtService = new JwtService({ secret: JWT_SECRET })
    const emailSender = createEmailSender(logger)
    const magicLinkService = new MagicLinkService(magicLinkRepo, emailSender, {
      baseUrl: APP_BASE_URL,
    })
    const verificationCodeService = new VerificationCodeService(verificationCodeRepo)

    // MessageEmitter para SSE
    const messageEmitter = new MessageEmitter()

    // App channel adapter com emitter
    const { AppChannelAdapter } = await import('@perpetuo/app-adapter')
    const appChannelAdapter = new AppChannelAdapter({ messageEmitter })

    // Pipeline para o canal app
    const appPipeline = new MessagePipeline({
      channel: appChannelAdapter,
      userRepo,
      aiProvider,
      logger,
      conversationRepo,
      attachmentRepo,
      avatarProfileRepo,
      diagnosticRepo,
      subscriptionRepo,
      rag,
      attachmentRag,
      transcriber,
      paymentUrl: process.env.PAYMENT_URL,
    })

    app.route(
      '/api/v1',
      createApiRoutes({
        jwtService,
        magicLinkService,
        verificationCodeService,
        sessionRepo,
        userRepo,
        conversationRepo,
        diagnosticRepo,
        subscriptionRepo,
        attachmentRepo,
        attachmentStorage,
        messageEmitter,
        appPipeline,
        paymentUrl: process.env.PAYMENT_URL,
        nativeCheckoutMode: NATIVE_CHECKOUT_MODE,
        logger,
      }),
    )

    logger.info('API REST routes enabled at /api/v1')
  } else {
    logger.warn('Auth repositories not configured, API REST routes disabled')
  }

  // Start server
  const port = Number(process.env.PORT) || 3000

  logger.info(`Starting server on port ${port}`)

  serve({
    fetch: app.fetch,
    port,
  })
}

main().catch((err) => {
  logger.error(err, 'Failed to start server')
  process.exit(1)
})
