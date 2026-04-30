import { describe, expect, it, vi } from 'vitest'

import { UazapiAdapter } from './uazapi.adapter.js'

describe('UazapiAdapter', () => {
  it('sends text messages through /send/text with instance token header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messageid: 'wamid-123' }),
    })

    const adapter = new UazapiAdapter({
      subdomain: 'api',
      instanceToken: 'instance-token',
      fetch: fetchMock as unknown as typeof fetch,
    })

    const result = await adapter.sendMessage({
      recipientId: '5511999999999',
      content: { type: 'text', text: 'Oi' },
    })

    expect(result).toEqual({ messageId: 'wamid-123' })
    expect(fetchMock).toHaveBeenCalledWith('https://api.uazapi.com/send/text', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        token: 'instance-token',
      },
      body: JSON.stringify({
        number: '5511999999999',
        text: 'Oi',
      }),
    })
  })

  it('parses incoming image webhooks and strips jid suffix from sender', () => {
    const adapter = new UazapiAdapter({
      subdomain: 'api',
      instanceToken: 'instance-token',
    })

    const message = adapter.parseWebhook({
      event: 'messages',
      instance: 'demo',
      data: {
        id: 'msg-1',
        sender: '5511999999999@s.whatsapp.net',
        messageType: 'image',
        messageTimestamp: 1_717_000_000_000,
        text: 'Analisa esse print',
        fileURL: 'https://cdn.example.com/print.jpg',
      },
    })

    expect(message).toEqual({
      externalId: 'msg-1',
      channelType: 'whatsapp',
      senderId: '5511999999999',
      timestamp: new Date(1_717_000_000_000),
      content: {
        type: 'image',
        url: 'https://cdn.example.com/print.jpg',
        caption: 'Analisa esse print',
        mediaType: undefined,
      },
      metadata: {
        event: 'messages',
        instance: 'demo',
      },
    })
  })

  it('ignores messages sent by the api to avoid loops', () => {
    const adapter = new UazapiAdapter({
      subdomain: 'api',
      instanceToken: 'instance-token',
    })

    const message = adapter.parseWebhook({
      event: 'messages',
      data: {
        id: 'msg-1',
        sender: '5511999999999@s.whatsapp.net',
        fromMe: true,
        text: 'eco',
      },
    })

    expect(message).toBeNull()
  })
})
