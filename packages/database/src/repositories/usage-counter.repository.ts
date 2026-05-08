import type { SupabaseClient } from '../client.js'

// Type assertion helper for tables not yet in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

export interface UsageCounter {
  id: string
  userId: string
  resourceType: string
  resourceId: string | null
  period: string // YYYY-MM format
  count: number
  limitValue: number | null
  createdAt: Date
  updatedAt: Date
}

export interface UsageCounterRepository {
  /**
   * Get current usage for a resource in a period
   */
  getUsage(params: {
    userId: string
    resourceType: string
    resourceId?: string
    period?: string
  }): Promise<UsageCounter | null>

  /**
   * Increment usage counter and return new count
   */
  increment(params: {
    userId: string
    resourceType: string
    resourceId?: string
    period?: string
    amount?: number
  }): Promise<{ count: number; limit: number | null; exceeded: boolean }>

  /**
   * Check if user has available quota
   */
  hasQuota(params: {
    userId: string
    resourceType: string
    resourceId?: string
    period?: string
  }): Promise<{ available: boolean; remaining: number | null; used: number; limit: number | null }>

  /**
   * Set limit for a resource type
   */
  setLimit(params: {
    userId: string
    resourceType: string
    resourceId?: string
    period?: string
    limit: number
  }): Promise<void>

  /**
   * Get all usage for a user in a period
   */
  getAllUsage(userId: string, period?: string): Promise<UsageCounter[]>
}

/**
 * Get current period in YYYY-MM format
 */
function getCurrentPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export class SupabaseUsageCounterRepository implements UsageCounterRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  // Use type assertion for tables not in generated types yet
  private get table(): AnyClient {
    return (this.supabase as AnyClient).from('usage_counters')
  }

  async getUsage(params: {
    userId: string
    resourceType: string
    resourceId?: string
    period?: string
  }): Promise<UsageCounter | null> {
    const period = params.period ?? getCurrentPeriod()

    let query = this.table
      .select('*')
      .eq('user_id', params.userId)
      .eq('resource_type', params.resourceType)
      .eq('period', period)

    if (params.resourceId) {
      query = query.eq('resource_id', params.resourceId)
    } else {
      query = query.is('resource_id', null)
    }

    const { data, error } = await query.single()

    if (error || !data) return null
    return this.mapUsageCounter(data)
  }

  async increment(params: {
    userId: string
    resourceType: string
    resourceId?: string
    period?: string
    amount?: number
  }): Promise<{ count: number; limit: number | null; exceeded: boolean }> {
    const period = params.period ?? getCurrentPeriod()
    const amount = params.amount ?? 1

    // Try to upsert (increment if exists, create if not)
    const { data: existing } = await this.table
      .select('*')
      .eq('user_id', params.userId)
      .eq('resource_type', params.resourceType)
      .eq('period', period)
      .eq('resource_id', params.resourceId ?? null)
      .single()

    if (existing) {
      // Update existing
      const newCount = existing.count + amount
      const { error } = await this.table
        .update({ count: newCount })
        .eq('id', existing.id)

      if (error) {
        throw new Error(`Failed to increment usage: ${error.message}`)
      }

      const limit = existing.limit_value
      return {
        count: newCount,
        limit,
        exceeded: limit !== null && newCount > limit,
      }
    }

    // Create new
    const { data, error } = await this.table
      .insert({
        user_id: params.userId,
        resource_type: params.resourceType,
        resource_id: params.resourceId ?? null,
        period,
        count: amount,
      })
      .select()
      .single()

    if (error || !data) {
      throw new Error(`Failed to create usage counter: ${error?.message}`)
    }

    return {
      count: amount,
      limit: null,
      exceeded: false,
    }
  }

  async hasQuota(params: {
    userId: string
    resourceType: string
    resourceId?: string
    period?: string
  }): Promise<{ available: boolean; remaining: number | null; used: number; limit: number | null }> {
    const usage = await this.getUsage(params)

    if (!usage) {
      return {
        available: true,
        remaining: null, // Unlimited until limit is set
        used: 0,
        limit: null,
      }
    }

    const used = usage.count
    const limit = usage.limitValue

    if (limit === null) {
      return {
        available: true,
        remaining: null,
        used,
        limit: null,
      }
    }

    const remaining = Math.max(0, limit - used)
    return {
      available: used < limit,
      remaining,
      used,
      limit,
    }
  }

  async setLimit(params: {
    userId: string
    resourceType: string
    resourceId?: string
    period?: string
    limit: number
  }): Promise<void> {
    const period = params.period ?? getCurrentPeriod()

    // Check if record exists
    const existing = await this.getUsage({
      userId: params.userId,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      period,
    })

    if (existing) {
      const { error } = await this.table
        .update({ limit_value: params.limit })
        .eq('id', existing.id)

      if (error) {
        throw new Error(`Failed to set limit: ${error.message}`)
      }
      return
    }

    // Create new record with limit
    const { error } = await this.table.insert({
      user_id: params.userId,
      resource_type: params.resourceType,
      resource_id: params.resourceId ?? null,
      period,
      count: 0,
      limit_value: params.limit,
    })

    if (error) {
      throw new Error(`Failed to create usage counter with limit: ${error.message}`)
    }
  }

  async getAllUsage(userId: string, period?: string): Promise<UsageCounter[]> {
    const currentPeriod = period ?? getCurrentPeriod()

    const { data, error } = await this.table
      .select('*')
      .eq('user_id', userId)
      .eq('period', currentPeriod)

    if (error || !data) return []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.map((row: any) => this.mapUsageCounter(row))
  }

  private mapUsageCounter(row: {
    id: string
    user_id: string
    resource_type: string
    resource_id: string | null
    period: string
    count: number
    limit_value: number | null
    created_at: string
    updated_at: string
  }): UsageCounter {
    return {
      id: row.id,
      userId: row.user_id,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      period: row.period,
      count: row.count,
      limitValue: row.limit_value,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }
  }
}
