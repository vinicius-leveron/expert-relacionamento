import { serve } from '@hono/node-server'
import type { UserRepository } from '@perpetuo/core'
import { Hono } from 'hono'
import { logger as honoLogger } from 'hono/logger'
import pino from 'pino'

import { MessagePipeline } from './pipeline/index.js'
import { createWhatsAppWebhookRoute, healthRoute } from './routes/index.js'

// Imports condicionais para evitar erro se env vars não existirem em dev
const createUserRepository = async () => {
  const { createSupabaseClient, SupabaseUserRepository } = await import('@perpetuo/database')
  const supabase = createSupabaseClient()
  return new SupabaseUserRepository(supabase)
}

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
})

async function main() {
  // Bootstrap (DI manual por enquanto)
  const { MockChannelAdapter } = await import('@perpetuo/whatsapp-adapter')

  let userRepo: UserRepository
  try {
    userRepo = await createUserRepository()
  } catch {
    // Fallback para mock em desenvolvimento sem Supabase
    logger.warn('Supabase not configured, using in-memory mock repository')
    const { createMockUserRepository } = await import('./repositories/mock-user.repository.js')
    userRepo = createMockUserRepository()
  }

  // TODO: Substituir por adapter real após ADR 0001
  const channelAdapter = new MockChannelAdapter()

  const pipeline = new MessagePipeline(channelAdapter, userRepo, logger)

  const app = new Hono()

  // Middleware
  app.use('*', honoLogger())

  // Routes
  app.route('/health', healthRoute)
  app.route('/webhook/whatsapp', createWhatsAppWebhookRoute(pipeline))

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
