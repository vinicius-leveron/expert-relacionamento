import type { SupabaseClient } from '../client.js'
import type { Json } from '../types.js'

export type SubscriptionStatus =
  | 'active'
  | 'cancelled'
  | 'expired'
  | 'pending'
  | 'payment_failed'

export interface Subscription {
  id: string
  userId: string
  externalId: string
  gateway: string
  planId: string
  status: SubscriptionStatus
  startDate: Date
  endDate: Date | null
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface SubscriptionRepository {
  /**
   * Busca assinatura ativa do usuário
   */
  getActiveByUserId(userId: string): Promise<Subscription | null>

  /**
   * Busca a assinatura mais recente do usuário, independentemente de status
   */
  getLatestByUserId(userId: string): Promise<Subscription | null>

  /**
   * Busca assinatura por ID externo (do gateway de pagamento)
   */
  getByExternalId(externalId: string): Promise<Subscription | null>

  /**
   * Verifica se usuário tem assinatura ativa
   */
  isActive(userId: string): Promise<boolean>

  /**
   * Cria nova assinatura
   */
  create(params: {
    userId: string
    externalId: string
    gateway: string
    planId: string
    status: SubscriptionStatus
    startDate: Date
    endDate?: Date
    metadata?: Record<string, unknown>
  }): Promise<Subscription>

  /**
   * Atualiza status da assinatura
   */
  updateStatus(id: string, status: SubscriptionStatus): Promise<void>

  /**
   * Atualiza assinatura por ID externo (para webhooks)
   */
  updateByExternalId(
    externalId: string,
    updates: Partial<Pick<Subscription, 'status' | 'endDate' | 'metadata'>>,
  ): Promise<void>
}

/**
 * SupabaseSubscriptionRepository - Implementação usando Supabase
 */
export class SupabaseSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getActiveByUserId(userId: string): Promise<Subscription | null> {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) return null

    return this.mapSubscription(data)
  }

  async getLatestByUserId(userId: string): Promise<Subscription | null> {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) return null

    return this.mapSubscription(data)
  }

  async getByExternalId(externalId: string): Promise<Subscription | null> {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('external_id', externalId)
      .single()

    if (error || !data) return null

    return this.mapSubscription(data)
  }

  async isActive(userId: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active')

    if (error) return false

    return (count ?? 0) > 0
  }

  async create(params: {
    userId: string
    externalId: string
    gateway: string
    planId: string
    status: SubscriptionStatus
    startDate: Date
    endDate?: Date
    metadata?: Record<string, unknown>
  }): Promise<Subscription> {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .insert({
        user_id: params.userId,
        external_id: params.externalId,
        gateway: params.gateway,
        plan_id: params.planId,
        status: params.status,
        start_date: params.startDate.toISOString(),
        end_date: params.endDate?.toISOString() ?? null,
        metadata: (params.metadata ?? {}) as Json,
      })
      .select()
      .single()

    if (error || !data) {
      throw new Error(`Failed to create subscription: ${error?.message}`)
    }

    return this.mapSubscription(data)
  }

  async updateStatus(id: string, status: SubscriptionStatus): Promise<void> {
    const { error } = await this.supabase.from('subscriptions').update({ status }).eq('id', id)

    if (error) {
      throw new Error(`Failed to update subscription status: ${error.message}`)
    }
  }

  async updateByExternalId(
    externalId: string,
    updates: Partial<Pick<Subscription, 'status' | 'endDate' | 'metadata'>>,
  ): Promise<void> {
    const updateData: {
      status?: string
      end_date?: string
      metadata?: Json
    } = {}

    if (updates.status) updateData.status = updates.status
    if (updates.endDate) updateData.end_date = updates.endDate.toISOString()
    if (updates.metadata) updateData.metadata = updates.metadata as Json

    const { error } = await this.supabase
      .from('subscriptions')
      .update(updateData)
      .eq('external_id', externalId)

    if (error) {
      throw new Error(`Failed to update subscription: ${error.message}`)
    }
  }

  private mapSubscription(row: {
    id: string
    user_id: string
    external_id: string
    gateway: string
    plan_id: string
    status: string
    start_date: string
    end_date: string | null
    metadata: unknown
    created_at: string
    updated_at: string
  }): Subscription {
    return {
      id: row.id,
      userId: row.user_id,
      externalId: row.external_id,
      gateway: row.gateway,
      planId: row.plan_id,
      status: row.status as SubscriptionStatus,
      startDate: new Date(row.start_date),
      endDate: row.end_date ? new Date(row.end_date) : null,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }
  }
}
