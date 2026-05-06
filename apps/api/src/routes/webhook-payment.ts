import { User, type PaymentPort, type UserRepository } from '@perpetuo/core'
import type { SubscriptionRepository } from '@perpetuo/database'
import { Hono } from 'hono'
import type { Logger } from 'pino'

type JsonRecord = Record<string, unknown>

export interface PaymentWebhookRouteDependencies {
  paymentAdapter?: PaymentPort
  userRepo: UserRepository
  subscriptionRepo?: SubscriptionRepository
  logger: Logger
}

export function createPaymentWebhookRoute(deps: PaymentWebhookRouteDependencies) {
  const app = new Hono()

  app.post('/', async (c) => {
    if (!deps.paymentAdapter || !deps.subscriptionRepo) {
      return c.json({ error: 'payment_not_configured' }, 503)
    }

    const signature = c.req.header('x-hubla-token') ?? ''
    const payload = (await c.req.json().catch(() => null)) as unknown

    if (!deps.paymentAdapter.validateWebhook(payload, signature)) {
      deps.logger.warn('Invalid payment webhook signature')
      return c.json({ error: 'invalid_signature' }, 401)
    }

    const event = deps.paymentAdapter.parseWebhook(payload)
    if (!event) {
      deps.logger.debug({ type: extractType(payload) }, 'Ignoring unsupported payment webhook event')
      return c.json({ received: true })
    }

    try {
      await syncPaymentEvent({
        event,
        payload,
        userRepo: deps.userRepo,
        subscriptionRepo: deps.subscriptionRepo,
        logger: deps.logger,
      })

      deps.logger.info(
        {
          type: event.type,
          externalSubscriptionId: event.externalSubscriptionId,
          email: event.email,
        },
        'Payment webhook processed',
      )

      return c.json({ received: true })
    } catch (error) {
      deps.logger.error({ error, type: event.type }, 'Failed to process payment webhook')
      return c.json({ error: 'processing_failed' }, 500)
    }
  })

  return app
}

async function syncPaymentEvent(params: {
  event: NonNullable<ReturnType<PaymentPort['parseWebhook']>>
  payload: unknown
  userRepo: UserRepository
  subscriptionRepo: SubscriptionRepository
  logger: Logger
}): Promise<void> {
  const { event, payload, userRepo, subscriptionRepo, logger } = params
  const rawPayload = asRecord(payload)
  const user = await resolveUserForPaymentEvent({ event, payload: rawPayload, userRepo, logger })

  const existing = await subscriptionRepo.getByExternalId(event.externalSubscriptionId)
  const metadata = buildSubscriptionMetadata(rawPayload, event, existing?.metadata)
  const nextStatus = mapSubscriptionStatus(event.type)

  if (!existing) {
    await subscriptionRepo.create({
      userId: user.id,
      externalId: event.externalSubscriptionId,
      gateway: 'hubla',
      planId: extractPlanId(rawPayload),
      status: nextStatus,
      startDate: extractStartDate(rawPayload),
      endDate: shouldSetEndDate(event.type) ? extractEndDate(rawPayload) ?? new Date() : undefined,
      metadata,
    })
    return
  }

  await subscriptionRepo.updateByExternalId(event.externalSubscriptionId, {
    status: nextStatus,
    endDate: shouldSetEndDate(event.type) ? extractEndDate(rawPayload) ?? new Date() : undefined,
    metadata,
  })
}

function buildSubscriptionMetadata(
  payload: JsonRecord | null,
  event: NonNullable<ReturnType<PaymentPort['parseWebhook']>>,
  previous: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const eventData = asRecord(payload?.event)
  const product = asRecord(eventData?.product)
  const subscription = asRecord(eventData?.subscription)
  const invoice = asRecord(eventData?.invoice)
  const invoicePayer = asRecord(invoice?.payer)
  const user = asRecord(eventData?.user)

  return {
    ...(previous ?? {}),
    hubla: {
      version: getString(payload, 'version'),
      lastEventType: getString(payload, 'type'),
      syncedAt: new Date().toISOString(),
      productId: getString(product, 'id'),
      productName: getString(product, 'name'),
      payerId: getString(subscription, 'payerId') ?? getString(invoice, 'payerId'),
      paymentMethod:
        getString(subscription, 'paymentMethod') ?? getString(invoice, 'paymentMethod'),
      subscriptionStatus: getString(subscription, 'status'),
      invoiceStatus: getString(invoice, 'status'),
      billingCycleMonths: getNumber(subscription, 'billingCycleMonths'),
      credits: getNumber(subscription, 'credits'),
      email:
        getString(subscription, 'email') ??
        getString(user, 'email') ??
        getString(invoicePayer, 'email') ??
        event.email,
      phoneE164: extractPaymentPhone(payload),
    },
  }
}

async function resolveUserForPaymentEvent(params: {
  event: NonNullable<ReturnType<PaymentPort['parseWebhook']>>
  payload: JsonRecord | null
  userRepo: UserRepository
  logger: Logger
}): Promise<User> {
  const { event, payload, userRepo, logger } = params
  const email = normalizeEmail(event.email)
  const phoneE164 = extractPaymentPhone(payload)

  const [emailUser, phoneUser] = await Promise.all([
    userRepo.findByEmail(email),
    phoneE164 ? userRepo.findByPhone(phoneE164) : Promise.resolve(null),
  ])

  if (emailUser && phoneUser && emailUser.id !== phoneUser.id) {
    throw new Error(
      `Payment identity conflict for email ${email} and phone ${phoneE164}: users ${emailUser.id} and ${phoneUser.id}`,
    )
  }

  if (emailUser) {
    if (phoneE164 && !emailUser.phoneE164) {
      return userRepo.linkPhone(emailUser.id, phoneE164)
    }

    if (phoneE164 && emailUser.phoneE164 && emailUser.phoneE164 !== phoneE164) {
      logger.warn(
        {
          userId: emailUser.id,
          email,
          linkedPhone: emailUser.phoneE164,
          webhookPhone: phoneE164,
        },
        'Payment webhook phone does not match linked phone',
      )
    }

    return emailUser
  }

  if (phoneUser) {
    if (!phoneUser.email) {
      return userRepo.linkEmail(phoneUser.id, email)
    }

    if (phoneUser.email !== email) {
      logger.warn(
        {
          userId: phoneUser.id,
          linkedEmail: phoneUser.email,
          webhookEmail: email,
          phoneE164,
        },
        'Payment webhook email does not match linked email',
      )
    }

    return phoneUser
  }

  const user = User.create({
    email,
    phoneE164: phoneE164 ?? undefined,
  })
  await userRepo.save(user)
  return user
}

function mapSubscriptionStatus(eventType: NonNullable<ReturnType<PaymentPort['parseWebhook']>>['type']) {
  switch (eventType) {
    case 'subscription_created':
      return 'pending' as const
    case 'subscription_renewed':
      return 'active' as const
    case 'subscription_cancelled':
      return 'cancelled' as const
    case 'payment_failed':
      return 'payment_failed' as const
  }
}

function shouldSetEndDate(eventType: NonNullable<ReturnType<PaymentPort['parseWebhook']>>['type']) {
  return eventType === 'subscription_cancelled'
}

function extractPlanId(payload: JsonRecord | null): string {
  const event = asRecord(payload?.event)
  const products = Array.isArray(event?.products) ? event?.products : []
  const firstProduct = asRecord(products[0])
  const offers = Array.isArray(firstProduct?.offers) ? firstProduct.offers : []
  const firstOffer = asRecord(offers[0])

  return (
    getString(firstOffer, 'id') ??
    getString(asRecord(event?.product), 'id') ??
    getString(firstProduct, 'id') ??
    'hubla-default'
  )
}

function extractStartDate(payload: JsonRecord | null): Date {
  const event = asRecord(payload?.event)
  const subscription = asRecord(event?.subscription)
  const invoice = asRecord(event?.invoice)

  return (
    parseDate(getString(subscription, 'activatedAt')) ??
    parseDate(getString(subscription, 'createdAt')) ??
    parseDate(getString(invoice, 'saleDate')) ??
    parseDate(getString(invoice, 'createdAt')) ??
    new Date()
  )
}

function extractEndDate(payload: JsonRecord | null): Date | undefined {
  const event = asRecord(payload?.event)
  const subscription = asRecord(event?.subscription)
  const invoice = asRecord(event?.invoice)

  return (
    parseDate(getString(subscription, 'inactivatedAt')) ??
    parseDate(getString(invoice, 'dueDate')) ??
    parseDate(getString(invoice, 'modifiedAt')) ??
    undefined
  )
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function extractType(payload: unknown): string | undefined {
  const record = asRecord(payload)
  return getString(record, 'type')
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function extractPaymentPhone(payload: JsonRecord | null): string | null {
  const event = asRecord(payload?.event)
  const subscription = asRecord(event?.subscription)
  const invoice = asRecord(event?.invoice)
  const invoicePayer = asRecord(invoice?.payer)
  const user = asRecord(event?.user)

  const rawPhone =
    getString(subscription, 'phone') ??
    getString(subscription, 'phoneNumber') ??
    getString(subscription, 'cellphone') ??
    getString(subscription, 'whatsapp') ??
    getString(user, 'phone') ??
    getString(user, 'phoneNumber') ??
    getString(user, 'cellphone') ??
    getString(user, 'whatsapp') ??
    getString(invoicePayer, 'phone') ??
    getString(invoicePayer, 'phoneNumber') ??
    getString(invoicePayer, 'cellphone') ??
    getString(invoicePayer, 'whatsapp')

  return normalizePhoneToE164(rawPhone)
}

function normalizePhoneToE164(rawPhone: string | undefined): string | null {
  if (!rawPhone) {
    return null
  }

  const trimmed = rawPhone.trim()
  if (!trimmed) {
    return null
  }

  const digits = trimmed.replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 15) {
    return null
  }

  if (trimmed.startsWith('+')) {
    return `+${digits}`
  }

  if (digits.startsWith('00') && digits.length > 10) {
    return `+${digits.slice(2)}`
  }

  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`
  }

  return `+${digits}`
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

function getNumber(record: JsonRecord | null | undefined, key: string): number | undefined {
  if (!record) {
    return undefined
  }

  const value = record[key]
  if (typeof value === 'number') {
    return value
  }

  return undefined
}
