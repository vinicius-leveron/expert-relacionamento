import { describe, expect, it } from 'vitest'

import { HublaPaymentAdapter } from './hubla.adapter.js'

describe('HublaPaymentAdapter', () => {
  it('validates webhook token from x-hubla-token', () => {
    const adapter = new HublaPaymentAdapter({ webhookToken: 'secret-token' })

    expect(adapter.validateWebhook({}, 'secret-token')).toBe(true)
    expect(adapter.validateWebhook({}, 'wrong-token')).toBe(false)
  })

  it('maps subscription.activated to a renewed subscription event', () => {
    const adapter = new HublaPaymentAdapter({ webhookToken: 'secret-token' })

    const event = adapter.parseWebhook({
      type: 'subscription.activated',
      event: {
        subscription: {
          id: 'sub-123',
          email: 'USER@EXAMPLE.COM',
        },
      },
    })

    expect(event).toEqual({
      type: 'subscription_renewed',
      externalSubscriptionId: 'sub-123',
      email: 'user@example.com',
      metadata: {
        hublaType: 'subscription.activated',
      },
    })
  })

  it('maps invoice.status_updated paid to a renewed subscription event', () => {
    const adapter = new HublaPaymentAdapter({ webhookToken: 'secret-token' })

    const event = adapter.parseWebhook({
      type: 'invoice.status_updated',
      event: {
        invoice: {
          id: 'invoice-1',
          subscriptionId: 'sub-999',
          status: 'paid',
          payer: {
            email: 'buyer@example.com',
          },
        },
      },
    })

    expect(event).toEqual({
      type: 'subscription_renewed',
      externalSubscriptionId: 'sub-999',
      email: 'buyer@example.com',
      metadata: {
        hublaType: 'invoice.status_updated',
      },
    })
  })
})
