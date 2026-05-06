import pino from 'pino'
import { describe, expect, it, vi } from 'vitest'
import { User } from '@perpetuo/core'
import type { Subscription, SubscriptionRepository } from '@perpetuo/database'
import { HublaPaymentAdapter } from '@perpetuo/payment-gateway'
import { createMockUserRepository } from '../repositories/mock-user.repository.js'
import { createPaymentWebhookRoute } from './webhook-payment.js'

function createLogger() {
  return pino({ level: 'silent' })
}

function createSubscriptionRepo() {
  const subscriptions = new Map<string, Subscription>()

  const repo: SubscriptionRepository = {
    getActiveByUserId: vi.fn(async () => null),
    getLatestByUserId: vi.fn(async () => null),
    getByExternalId: vi.fn(async (externalId: string) => subscriptions.get(externalId) ?? null),
    isActive: vi.fn(async () => false),
    create: vi.fn(
      async (params: {
        userId: string
        externalId: string
        gateway: string
        planId: string
        status: Subscription['status']
        startDate: Date
        endDate?: Date
        metadata?: Record<string, unknown>
      }) => {
        const subscription: Subscription = {
          id: `subscription-${subscriptions.size + 1}`,
          userId: params.userId,
          externalId: params.externalId,
          gateway: params.gateway,
          planId: params.planId,
          status: params.status,
          startDate: params.startDate,
          endDate: params.endDate ?? null,
          metadata: params.metadata ?? {},
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        subscriptions.set(params.externalId, subscription)
        return subscription
      },
    ),
    updateStatus: vi.fn(async () => {}),
    updateByExternalId: vi.fn(
      async (
        externalId: string,
        updates: Partial<Pick<Subscription, 'status' | 'endDate' | 'metadata'>>,
      ) => {
        const existing = subscriptions.get(externalId)
        if (!existing) {
          return
        }

        subscriptions.set(externalId, {
          ...existing,
          status: updates.status ?? existing.status,
          endDate: updates.endDate ?? existing.endDate,
          metadata: updates.metadata ?? existing.metadata,
          updatedAt: new Date(),
        })
      },
    ),
  }

  return { repo, subscriptions }
}

function createPayload(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: 'evt-1',
    type: 'subscription.activated',
    event: {
      subscription: {
        id: 'sub-123',
        email: 'buyer@example.com',
        phone: '(11) 99999-9999',
        createdAt: '2026-05-06T12:00:00.000Z',
        activatedAt: '2026-05-06T12:05:00.000Z',
      },
      product: {
        id: 'plan-pro',
        name: 'Plano Pro',
      },
      user: {
        email: 'buyer@example.com',
      },
    },
    ...overrides,
  }
}

describe('createPaymentWebhookRoute', () => {
  it('links checkout email to an existing WhatsApp user', async () => {
    const userRepo = createMockUserRepository()
    const existingUser = User.create({ phoneE164: '+5511999999999' })
    await userRepo.save(existingUser)

    const { repo: subscriptionRepo, subscriptions } = createSubscriptionRepo()
    const app = createPaymentWebhookRoute({
      paymentAdapter: new HublaPaymentAdapter({ webhookToken: 'secret-token' }),
      userRepo,
      subscriptionRepo,
      logger: createLogger(),
    })

    const response = await app.request('http://localhost/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hubla-token': 'secret-token',
      },
      body: JSON.stringify(createPayload()),
    })

    expect(response.status).toBe(200)

    const updatedUser = await userRepo.findByPhone('+5511999999999')
    expect(updatedUser?.id).toBe(existingUser.id)
    expect(updatedUser?.email).toBe('buyer@example.com')

    const subscription = subscriptions.get('sub-123')
    expect(subscription?.userId).toBe(existingUser.id)
    expect(subscription?.metadata).toMatchObject({
      hubla: {
        email: 'buyer@example.com',
        phoneE164: '+5511999999999',
      },
    })
  })

  it('links WhatsApp phone to an existing email user', async () => {
    const userRepo = createMockUserRepository()
    const existingUser = User.create({ email: 'buyer@example.com' })
    await userRepo.save(existingUser)

    const { repo: subscriptionRepo, subscriptions } = createSubscriptionRepo()
    const app = createPaymentWebhookRoute({
      paymentAdapter: new HublaPaymentAdapter({ webhookToken: 'secret-token' }),
      userRepo,
      subscriptionRepo,
      logger: createLogger(),
    })

    const response = await app.request('http://localhost/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hubla-token': 'secret-token',
      },
      body: JSON.stringify(createPayload()),
    })

    expect(response.status).toBe(200)

    const updatedUser = await userRepo.findByEmail('buyer@example.com')
    expect(updatedUser?.id).toBe(existingUser.id)
    expect(updatedUser?.phoneE164).toBe('+5511999999999')

    const subscription = subscriptions.get('sub-123')
    expect(subscription?.userId).toBe(existingUser.id)
  })

  it('returns 500 when email and phone belong to different users', async () => {
    const userRepo = createMockUserRepository()
    const emailUser = User.create({ email: 'buyer@example.com' })
    const phoneUser = User.create({ phoneE164: '+5511999999999' })
    await userRepo.save(emailUser)
    await userRepo.save(phoneUser)

    const { repo: subscriptionRepo, subscriptions } = createSubscriptionRepo()
    const app = createPaymentWebhookRoute({
      paymentAdapter: new HublaPaymentAdapter({ webhookToken: 'secret-token' }),
      userRepo,
      subscriptionRepo,
      logger: createLogger(),
    })

    const response = await app.request('http://localhost/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hubla-token': 'secret-token',
      },
      body: JSON.stringify(createPayload()),
    })

    expect(response.status).toBe(500)
    expect(subscriptions.size).toBe(0)

    const payload = await response.json()
    expect(payload).toMatchObject({
      error: 'processing_failed',
    })
  })
})
