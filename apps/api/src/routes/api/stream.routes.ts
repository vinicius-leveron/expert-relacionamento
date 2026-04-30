import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { JwtService } from '@perpetuo/core'
import type { MessageEmitter } from '../../events/message-emitter.js'
import { createAuthMiddleware } from '../../middleware/auth.middleware.js'
import type { Logger } from 'pino'

export interface StreamRoutesConfig {
  jwtService: JwtService
  messageEmitter: MessageEmitter
  logger: Logger
}

export function createStreamRoutes(config: StreamRoutesConfig) {
  const { jwtService, messageEmitter, logger } = config
  const app = new Hono()

  const authMiddleware = createAuthMiddleware({ jwtService })

  /**
   * GET /messages
   * SSE endpoint para receber mensagens em tempo real
   */
  app.get('/messages', authMiddleware, async (c) => {
    const userId = c.get('userId')

    logger.info({ userId }, 'SSE connection opened')

    return streamSSE(c, async (stream) => {
      let isConnected = true

      // Handler para mensagens
      const unsubscribe = messageEmitter.subscribe(userId, async (message) => {
        if (!isConnected) return

        try {
          await stream.writeSSE({
            data: JSON.stringify(message),
            event: message.type,
            id: message.id,
          })
        } catch (error) {
          logger.error({ error, userId }, 'Failed to write SSE message')
        }
      })

      // Envia evento de conexão estabelecida
      await stream.writeSSE({
        data: JSON.stringify({ status: 'connected', timestamp: new Date().toISOString() }),
        event: 'connected',
        id: 'connection',
      })

      // Keepalive a cada 30 segundos
      const keepaliveInterval = setInterval(async () => {
        if (!isConnected) return

        try {
          await stream.writeSSE({
            data: '',
            event: 'ping',
          })
        } catch {
          // Connection closed
          isConnected = false
        }
      }, 30000)

      // Cleanup quando a conexão for fechada
      stream.onAbort(() => {
        isConnected = false
        clearInterval(keepaliveInterval)
        unsubscribe()
        logger.info({ userId }, 'SSE connection closed')
      })

      // Mantém a conexão aberta
      // O stream será fechado quando o cliente desconectar
      await new Promise(() => {
        // Never resolves - keeps stream open until abort
      })
    })
  })

  return app
}
