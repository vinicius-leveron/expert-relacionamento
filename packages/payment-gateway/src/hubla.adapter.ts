import type { PaymentEvent, PaymentPort, Subscription } from '@perpetuo/core'

export interface HublaPaymentAdapterConfig {
  webhookToken: string
}

type JsonRecord = Record<string, unknown>

export class HublaPaymentAdapter implements PaymentPort {
  constructor(private readonly config: HublaPaymentAdapterConfig) {}

  validateWebhook(_payload: unknown, signature: string): boolean {
    return signature.length > 0 && signature === this.config.webhookToken
  }

  parseWebhook(payload: unknown): PaymentEvent | null {
    const data = asRecord(payload)
    if (!data) {
      return null
    }

    const type = getString(data, 'type')
    if (!type) {
      return null
    }

    const event = asRecord(data.event)
    const subscription = asRecord(event?.subscription)
    const invoice = asRecord(event?.invoice)
    const invoicePayer = asRecord(invoice?.payer)
    const user = asRecord(event?.user)

    const externalSubscriptionId =
      getString(subscription, 'id') ??
      getString(invoice, 'subscriptionId') ??
      getString(invoice, 'id')

    const email =
      getString(subscription, 'email') ??
      getString(user, 'email') ??
      getString(invoicePayer, 'email')

    if (!externalSubscriptionId || !email) {
      return null
    }

    const mappedType = mapHublaEventType(type, invoice)
    if (!mappedType) {
      return null
    }

    return {
      type: mappedType,
      externalSubscriptionId,
      email: email.toLowerCase(),
      metadata: {
        hublaType: type,
      },
    }
  }

  async getSubscriptionStatus(_externalId: string): Promise<Subscription | null> {
    // A integração com a Hubla é webhook-driven. O status corrente é persistido no nosso banco.
    return null
  }
}

function mapHublaEventType(
  hublaType: string,
  invoice: JsonRecord | null | undefined,
): PaymentEvent['type'] | null {
  switch (hublaType) {
    case 'subscription.created':
      return 'subscription_created'
    case 'subscription.activated':
      return 'subscription_renewed'
    case 'subscription.deactivated':
      return 'subscription_cancelled'
    case 'invoice.payment_succeeded':
      return 'subscription_renewed'
    case 'invoice.payment_failed':
      return 'payment_failed'
    case 'invoice.expired':
    case 'invoice.refunded':
      return 'subscription_cancelled'
    case 'invoice.status_updated': {
      const status = getString(invoice, 'status')
      switch (status) {
        case 'paid':
          return 'subscription_renewed'
        case 'expired':
        case 'refunded':
        case 'chargeback':
          return 'subscription_cancelled'
        case 'failed':
          return 'payment_failed'
        case 'draft':
        case 'unpaid':
          return 'subscription_created'
        default:
          return null
      }
    }
    default:
      return null
  }
}

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null ? (value as JsonRecord) : null
}

function getString(record: JsonRecord | null | undefined, key: string): string | undefined {
  if (!record) {
    return undefined
  }

  const value = record[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}
