import pino from 'pino'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import type { ImageGenerationService } from '@perpetuo/ai-gateway'
import type {
  Subscription,
  SubscriptionRepository,
  UsageCounter,
  UsageCounterRepository,
} from '@perpetuo/database'
import { createImageRoutes } from './image.routes.js'

function createLogger() {
  return pino({ level: 'silent' })
}

function createImageService() {
  return {
    generate: vi.fn(async () => ({
      image: {
        base64: 'ZmFrZS1pbWFnZQ==',
        mimeType: 'image/png',
      },
      provider: 'gemini-imagen',
    })),
  } as unknown as ImageGenerationService
}

function createUsageCounterRepo(initialCount = 0, limit = 30): UsageCounterRepository {
  let currentCount = initialCount
  let currentLimit: number | null = limit

  const buildUsage = (): UsageCounter => ({
    id: 'usage-1',
    userId: 'user-1',
    resourceType: 'image_generation',
    resourceId: null,
    period: '2026-05',
    count: currentCount,
    limitValue: currentLimit,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  return {
    getUsage: vi.fn(async () => buildUsage()),
    increment: vi.fn(async () => {
      currentCount += 1
      return {
        count: currentCount,
        limit: currentLimit,
        exceeded: currentLimit !== null && currentCount > currentLimit,
      }
    }),
    hasQuota: vi.fn(async () => ({
      available: currentLimit === null ? true : currentCount < currentLimit,
      remaining: currentLimit === null ? null : Math.max(0, currentLimit - currentCount),
      used: currentCount,
      limit: currentLimit,
    })),
    setLimit: vi.fn(async ({ limit: nextLimit }) => {
      currentLimit = nextLimit
    }),
    getAllUsage: vi.fn(async () => [buildUsage()]),
  }
}

function createUnavailableUsageCounterRepo(): UsageCounterRepository {
  const error = new Error(
    "Failed to create usage counter with limit: Could not find the table 'public.usage_counters' in the schema cache",
  )

  return {
    getUsage: vi.fn(async () => {
      throw error
    }),
    increment: vi.fn(async () => {
      throw error
    }),
    hasQuota: vi.fn(async () => {
      throw error
    }),
    setLimit: vi.fn(async () => {
      throw error
    }),
    getAllUsage: vi.fn(async () => {
      throw error
    }),
  }
}

function createSubscriptionRepo(active = true): SubscriptionRepository {
  return {
    getActiveByUserId: vi.fn(async () =>
      active
        ? ({
            id: 'sub-1',
            userId: 'user-1',
            externalId: 'ext-1',
            gateway: 'hubla',
            planId: 'premium',
            status: 'active',
            startDate: new Date(),
            endDate: null,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          } satisfies Subscription)
        : null,
    ),
    getLatestByUserId: vi.fn(async () => null),
    getByExternalId: vi.fn(async () => null),
    isActive: vi.fn(async () => active),
    create: vi.fn(async () => {
      throw new Error('Not implemented in test')
    }),
    updateStatus: vi.fn(async () => {}),
    updateByExternalId: vi.fn(async () => {}),
  }
}

function createApp(deps?: {
  imageService?: ImageGenerationService
  usageCounterRepo?: UsageCounterRepository
  subscriptionRepo?: SubscriptionRepository
}) {
  const app = new Hono()
  app.use('*', async (c, next) => {
    c.set('userId', 'user-1')
    await next()
  })
  app.route(
    '/',
    createImageRoutes({
      imageService: deps?.imageService,
      usageCounterRepo: deps?.usageCounterRepo,
      subscriptionRepo: deps?.subscriptionRepo,
      logger: createLogger(),
    }),
  )
  return app
}

describe('createImageRoutes', () => {
  it('returns generated image payload and updates quota', async () => {
    const imageService = createImageService()
    const usageCounterRepo = createUsageCounterRepo()
    const app = createApp({
      imageService,
      usageCounterRepo,
      subscriptionRepo: createSubscriptionRepo(true),
    })

    const response = await app.request('http://localhost/generate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'um retrato editorial minimalista',
      }),
    })

    expect(response.status).toBe(200)
    expect(imageService.generate).toHaveBeenCalledWith(
      'user-1',
      'um retrato editorial minimalista',
      {
        style: 'vivid',
        size: '1024x1024',
        quality: 'standard',
      },
    )
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('29')

    const payload = await response.json()
    expect(payload).toMatchObject({
      success: true,
      provider: 'gemini-imagen',
      image: {
        base64: 'ZmFrZS1pbWFnZQ==',
        mimeType: 'image/png',
      },
      rateLimitInfo: {
        remaining: 29,
      },
    })
  })

  it('blocks generation when the subscription is inactive', async () => {
    const app = createApp({
      imageService: createImageService(),
      usageCounterRepo: createUsageCounterRepo(),
      subscriptionRepo: createSubscriptionRepo(false),
    })

    const response = await app.request('http://localhost/generate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'uma capa de livro cinematografica',
      }),
    })

    expect(response.status).toBe(403)
    const payload = await response.json()
    expect(payload).toMatchObject({
      success: false,
      error: {
        code: 'SUBSCRIPTION_REQUIRED',
      },
    })
  })

  it('returns 429 when the monthly quota is exhausted', async () => {
    const app = createApp({
      imageService: createImageService(),
      usageCounterRepo: createUsageCounterRepo(30, 30),
      subscriptionRepo: createSubscriptionRepo(true),
    })

    const response = await app.request('http://localhost/generate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'uma logo dourada minimalista',
      }),
    })

    expect(response.status).toBe(429)
    const payload = await response.json()
    expect(payload).toMatchObject({
      error: 'rate_limit_exceeded',
      usage: {
        used: 30,
        limit: 30,
        remaining: 0,
      },
    })
  })

  it('reports the current quota status', async () => {
    const app = createApp({
      imageService: createImageService(),
      usageCounterRepo: createUsageCounterRepo(7, 30),
      subscriptionRepo: createSubscriptionRepo(true),
    })

    const response = await app.request('http://localhost/quota')

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toMatchObject({
      available: true,
      used: 7,
      remaining: 23,
      limit: 30,
    })
  })

  it('falls back to a stateless quota response when usage_counters is unavailable', async () => {
    const app = createApp({
      imageService: createImageService(),
      usageCounterRepo: createUnavailableUsageCounterRepo(),
      subscriptionRepo: createSubscriptionRepo(true),
    })

    const response = await app.request('http://localhost/quota')

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toMatchObject({
      available: true,
      used: 0,
      remaining: 30,
      limit: 30,
    })
  })

  it('still generates images when usage_counters is unavailable', async () => {
    const imageService = createImageService()
    const app = createApp({
      imageService,
      usageCounterRepo: createUnavailableUsageCounterRepo(),
      subscriptionRepo: createSubscriptionRepo(true),
    })

    const response = await app.request('http://localhost/generate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'um retrato editorial cinematografico',
      }),
    })

    expect(response.status).toBe(200)
    expect(imageService.generate).toHaveBeenCalledOnce()
    const payload = await response.json()
    expect(payload).toMatchObject({
      success: true,
      provider: 'gemini-imagen',
      image: {
        base64: 'ZmFrZS1pbWFnZQ==',
        mimeType: 'image/png',
      },
    })
  })
})
