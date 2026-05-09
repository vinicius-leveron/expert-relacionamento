import type { UsageCounterRepository } from '@perpetuo/database'
import type { Logger } from 'pino'

export interface MonthlyQuotaStatus {
  available: boolean
  remaining: number
  used: number
  limit: number
}

export async function ensureMonthlyQuota(params: {
  userId: string
  resourceType: string
  limit: number
  usageCounterRepo?: UsageCounterRepository
}): Promise<MonthlyQuotaStatus | null> {
  const { usageCounterRepo } = params
  if (!usageCounterRepo) {
    return null
  }

  const currentUsage = await usageCounterRepo.getUsage({
    userId: params.userId,
    resourceType: params.resourceType,
  })

  if (!currentUsage || currentUsage.limitValue !== params.limit) {
    await usageCounterRepo.setLimit({
      userId: params.userId,
      resourceType: params.resourceType,
      limit: params.limit,
    })
  }

  const quota = await usageCounterRepo.hasQuota({
    userId: params.userId,
    resourceType: params.resourceType,
  })

  return {
    available: quota.available,
    remaining: quota.remaining ?? Math.max(params.limit - quota.used, 0),
    used: quota.used,
    limit: quota.limit ?? params.limit,
  }
}

export async function loadMonthlyQuota(params: {
  userId: string
  resourceType: string
  limit: number
  usageCounterRepo?: UsageCounterRepository
  logger: Logger
  unavailableWarningMessage: string
}): Promise<MonthlyQuotaStatus | null> {
  try {
    return await ensureMonthlyQuota(params)
  } catch (error) {
    if (!isUsageCounterStorageUnavailable(error)) {
      throw error
    }

    params.logger.warn({ error, userId: params.userId }, params.unavailableWarningMessage)
    return null
  }
}

export async function incrementMonthlyQuota(params: {
  userId: string
  resourceType: string
  usageCounterRepo?: UsageCounterRepository
  logger: Logger
  unavailableWarningMessage: string
}): Promise<{ count: number; limit: number | null; exceeded: boolean } | null> {
  if (!params.usageCounterRepo) {
    return null
  }

  try {
    return await params.usageCounterRepo.increment({
      userId: params.userId,
      resourceType: params.resourceType,
    })
  } catch (error) {
    if (!isUsageCounterStorageUnavailable(error)) {
      throw error
    }

    params.logger.warn({ error, userId: params.userId }, params.unavailableWarningMessage)
    return null
  }
}

export function isUsageCounterStorageUnavailable(error: unknown): boolean {
  return error instanceof Error && error.message.includes('usage_counters')
}

export function getCurrentPeriodResetAt(): number {
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return nextMonth.getTime()
}
