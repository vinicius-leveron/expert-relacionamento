import type { SubscriptionRepository } from '@perpetuo/database'

export interface SubscriptionCheckResult {
  hasAccess: boolean
  reason?: 'no_subscription' | 'expired' | 'cancelled'
  message?: string
}

const BLOCKED_MESSAGES = {
  no_subscription: `Oi! Para continuar nossa conversa e começar sua jornada de transformação, você precisa ativar seu acesso.

Acesse o link abaixo para garantir sua vaga:
[LINK_PLACEHOLDER]

Qualquer dúvida, é só me chamar! 💜`,

  expired: `Ei, notei que seu acesso expirou!

Que tal renovar para continuarmos juntos? A jornada fica ainda melhor quando você se compromete com ela.

Renove aqui: [LINK_PLACEHOLDER]`,

  cancelled: `Vi que você cancelou seu acesso... Espero que esteja tudo bem!

Se quiser voltar, as portas estão sempre abertas:
[LINK_PLACEHOLDER]`,
} as const

/**
 * SubscriptionGuard - Verifica se usuário tem acesso
 *
 * Para MVP, funciona em modo "soft" - apenas registra sem bloquear.
 * Pode ser configurado para bloquear após definição de paywall.
 */
export class SubscriptionGuard {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly options: {
      /** Se true, bloqueia acesso. Se false, apenas loga. */
      enforcePaywall: boolean
      /** URL para redirecionamento de pagamento */
      paymentUrl?: string
    } = { enforcePaywall: false },
  ) {}

  /**
   * Verifica se usuário tem acesso
   */
  async checkAccess(userId: string): Promise<SubscriptionCheckResult> {
    const isActive = await this.subscriptionRepo.isActive(userId)

    if (isActive) {
      return { hasAccess: true }
    }

    // Busca última assinatura para determinar razão
    const subscription = await this.getLastSubscription(userId)

    if (!subscription) {
      return {
        hasAccess: !this.options.enforcePaywall,
        reason: 'no_subscription',
        message: this.formatMessage('no_subscription'),
      }
    }

    if (subscription.status === 'expired') {
      return {
        hasAccess: !this.options.enforcePaywall,
        reason: 'expired',
        message: this.formatMessage('expired'),
      }
    }

    if (subscription.status === 'cancelled') {
      return {
        hasAccess: !this.options.enforcePaywall,
        reason: 'cancelled',
        message: this.formatMessage('cancelled'),
      }
    }

    return {
      hasAccess: !this.options.enforcePaywall,
      reason: 'no_subscription',
      message: this.formatMessage('no_subscription'),
    }
  }

  /**
   * Busca última assinatura (qualquer status)
   */
  private async getLastSubscription(userId: string) {
    // Usa getActiveByUserId como proxy - em produção, criar método específico
    return this.subscriptionRepo.getActiveByUserId(userId)
  }

  /**
   * Formata mensagem com URL de pagamento
   */
  private formatMessage(reason: keyof typeof BLOCKED_MESSAGES): string {
    const url = this.options.paymentUrl ?? 'https://perpetuo.com.br/assinar'
    return BLOCKED_MESSAGES[reason].replace('[LINK_PLACEHOLDER]', url)
  }

  /**
   * Verifica e retorna mensagem de bloqueio se necessário
   * Retorna null se tem acesso
   */
  async getBlockMessage(userId: string): Promise<string | null> {
    const result = await this.checkAccess(userId)

    if (result.hasAccess) return null

    return result.message ?? BLOCKED_MESSAGES.no_subscription
  }
}
