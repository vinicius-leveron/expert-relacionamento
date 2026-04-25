import { Hono } from 'hono'
import type { MessagePipeline } from '../pipeline/message-pipeline.js'

export function createWhatsAppWebhookRoute(pipeline: MessagePipeline) {
  const app = new Hono()

  // Verificação de webhook (GET) - WhatsApp Cloud API / Z-API
  app.get('/', (c) => {
    const mode = c.req.query('hub.mode')
    const token = c.req.query('hub.verify_token')
    const challenge = c.req.query('hub.challenge')

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN

    if (mode === 'subscribe' && token === verifyToken) {
      return c.text(challenge ?? '')
    }

    return c.text('Forbidden', 403)
  })

  // Recebe mensagens (POST)
  app.post('/', async (c) => {
    const signature = c.req.header('x-hub-signature-256') ?? ''
    const payload = await c.req.json()

    const result = await pipeline.process(payload, signature)

    if (!result.success && result.error === 'invalid_signature') {
      return c.json({ error: 'invalid_signature' }, 401)
    }

    // Sempre retorna 200 para webhooks válidos
    return c.json({ received: true })
  })

  return app
}
