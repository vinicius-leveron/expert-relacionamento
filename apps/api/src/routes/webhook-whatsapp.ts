import { Hono } from 'hono'
import type { MessagePipeline } from '../pipeline/message-pipeline.js'

export function createWhatsAppWebhookRoute(pipeline: MessagePipeline) {
  const app = new Hono()
  const provider = (process.env.WHATSAPP_PROVIDER ?? '').toLowerCase()

  // Verificação de webhook (GET) - WhatsApp Cloud API / Z-API
  app.get('/', (c) => {
    if (provider === 'uazapi') {
      return c.text('ok')
    }

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
  const handler = async (c: any) => {
    const signature =
      provider === 'uazapi'
        ? c.req.header('x-signature') ?? ''
        : c.req.header('x-hub-signature-256') ?? ''

    const payload = await c.req.json()
    const eventPath = c.req.param('event')
    const messageTypePath = c.req.param('messageType')
    const enrichedPayload =
      provider === 'uazapi' ? enrichUazapiPayload(payload, eventPath, messageTypePath) : payload

    const result = await pipeline.process(enrichedPayload, signature)

    if (!result.success && result.error === 'invalid_signature') {
      return c.json({ error: 'invalid_signature' }, 401)
    }

    // Sempre retorna 200 para webhooks válidos
    return c.json({ received: true })
  }

  app.post('/', handler)
  app.post('/:event', handler)
  app.post('/:event/:messageType', handler)

  return app
}

function enrichUazapiPayload(
  payload: unknown,
  eventPath: string | undefined,
  messageTypePath: string | undefined,
): unknown {
  if (typeof payload !== 'object' || payload === null) {
    return payload
  }

  const record = payload as Record<string, unknown>
  const nextRecord: Record<string, unknown> = { ...record }

  if (eventPath && typeof nextRecord.event !== 'string') {
    nextRecord.event = eventPath
  }

  if (
    messageTypePath &&
    typeof nextRecord.data === 'object' &&
    nextRecord.data !== null &&
    !('messageType' in (nextRecord.data as Record<string, unknown>))
  ) {
    nextRecord.data = {
      ...(nextRecord.data as Record<string, unknown>),
      messageType: messageTypePath,
    }
  }

  return nextRecord
}
