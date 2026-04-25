/**
 * PaymentPort - Interface para gateway de pagamento (ADR 0002 pendente)
 * Implementações: HotmartAdapter, KiwifyAdapter, RublaAdapter, StripeAdapter
 */
export interface Subscription {
  id: string
  userId: string
  status: 'active' | 'cancelled' | 'expired' | 'pending'
  planId: string
  startDate: Date
  endDate: Date
  externalId: string // ID no gateway
}

export interface PaymentEvent {
  type:
    | 'subscription_created'
    | 'subscription_cancelled'
    | 'subscription_renewed'
    | 'payment_failed'
  externalSubscriptionId: string
  email: string
  metadata?: Record<string, unknown>
}

export interface PaymentPort {
  /**
   * Valida webhook signature do gateway
   */
  validateWebhook(payload: unknown, signature: string): boolean

  /**
   * Parseia webhook payload
   */
  parseWebhook(payload: unknown): PaymentEvent | null

  /**
   * Verifica status de assinatura
   */
  getSubscriptionStatus(externalId: string): Promise<Subscription | null>
}
