import type { PaymentEvent, PaymentPort, Subscription } from '@perpetuo/core'

/**
 * MockPaymentAdapter - Adapter para testes sem gateway real
 *
 * Simula comportamento de um gateway de pagamento.
 * Todos os webhooks são aceitos e todos os usuários têm assinatura ativa.
 */
export class MockPaymentAdapter implements PaymentPort {
  private subscriptions: Map<string, Subscription> = new Map()

  constructor() {
    // Cria uma assinatura mock padrão
    this.subscriptions.set('mock-subscription-1', {
      id: 'sub-mock-1',
      userId: 'mock-user-id',
      status: 'active',
      planId: 'plan-30-days',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
      externalId: 'mock-subscription-1',
    })
  }

  validateWebhook(_payload: unknown, _signature: string): boolean {
    // Mock sempre aceita webhooks
    return true
  }

  parseWebhook(payload: unknown): PaymentEvent | null {
    // Tenta parsear como um evento mock
    if (typeof payload === 'object' && payload !== null) {
      const p = payload as Record<string, unknown>
      if (p.type && typeof p.type === 'string') {
        return {
          type: p.type as PaymentEvent['type'],
          externalSubscriptionId: (p.subscriptionId as string) ?? 'mock-subscription-1',
          email: (p.email as string) ?? 'mock@example.com',
          metadata: p.metadata as Record<string, unknown>,
        }
      }
    }
    return null
  }

  async getSubscriptionStatus(externalId: string): Promise<Subscription | null> {
    // Retorna assinatura mock ou cria uma nova
    const existing = this.subscriptions.get(externalId)
    if (existing) {
      return existing
    }

    // Para qualquer ID, retorna uma assinatura ativa mock
    const mockSubscription: Subscription = {
      id: `sub-${externalId}`,
      userId: 'mock-user-id',
      status: 'active',
      planId: 'plan-30-days',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      externalId,
    }

    this.subscriptions.set(externalId, mockSubscription)
    return mockSubscription
  }

  /**
   * Helper para testes - adiciona assinatura customizada
   */
  addMockSubscription(subscription: Subscription): void {
    this.subscriptions.set(subscription.externalId, subscription)
  }

  /**
   * Helper para testes - simula cancelamento
   */
  cancelSubscription(externalId: string): void {
    const sub = this.subscriptions.get(externalId)
    if (sub) {
      sub.status = 'cancelled'
    }
  }

  /**
   * Helper para testes - simula expiração
   */
  expireSubscription(externalId: string): void {
    const sub = this.subscriptions.get(externalId)
    if (sub) {
      sub.status = 'expired'
      sub.endDate = new Date(Date.now() - 1000) // No passado
    }
  }
}
