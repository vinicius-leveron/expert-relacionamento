import { Hono } from 'hono'
import type { Logger } from 'pino'
import {
  ImageGenerationService,
  RateLimitExceededError,
  type ImageGenerationOptions,
} from '@perpetuo/ai-gateway'
import type { SubscriptionRepository, UsageCounterRepository } from '@perpetuo/database'

const IMAGE_GENERATION_RESOURCE_TYPE = 'image_generation'
const IMAGE_GENERATION_MONTHLY_LIMIT = 30
const IMAGE_STYLES = new Set(['vivid', 'natural'] as const)
const IMAGE_SIZES = new Set(['256x256', '512x512', '1024x1024'] as const)
const IMAGE_QUALITIES = new Set(['standard', 'hd'] as const)

type ImageStyle = 'vivid' | 'natural'
type ImageSize = '256x256' | '512x512' | '1024x1024'
type ImageQuality = 'standard' | 'hd'

export interface ImageRouteDependencies {
  imageService?: ImageGenerationService
  usageCounterRepo?: UsageCounterRepository
  subscriptionRepo?: SubscriptionRepository
  logger: Logger
}

export function createImageRoutes(deps: ImageRouteDependencies) {
  const app = new Hono()

  /**
   * POST /generate
   * Generate an image from a text prompt
   */
  app.post('/generate', async (c) => {
    if (!deps.imageService) {
      return c.json({ error: 'image_generation_not_configured' }, 503)
    }

    const userId = c.get('userId') as string | undefined
    if (!userId) {
      return c.json({ error: 'unauthorized' }, 401)
    }

    const subscriptionGate = await requireActiveSubscription(userId, deps.subscriptionRepo)
    if (subscriptionGate) {
      return c.json(subscriptionGate.body, subscriptionGate.status)
    }

    const quota = await ensureImageGenerationQuota(userId, deps.usageCounterRepo)
    if (quota && !quota.available) {
      c.header('X-RateLimit-Remaining', '0')
      c.header('X-RateLimit-Reset', String(getCurrentPeriodResetAt()))
      return c.json(
        {
          error: 'rate_limit_exceeded',
          message: 'You have reached your monthly image generation limit',
          resetAt: getCurrentPeriodResetAt(),
          usage: {
            used: quota.used,
            limit: quota.limit,
            remaining: 0,
          },
        },
        429,
      )
    }

    const rawBody = await c.req.json().catch(() => null)
    const body = parseGenerateRequest(rawBody)
    if (!body.success) {
      return c.json(body.error, 400)
    }

    deps.logger.info(
      { userId, prompt: body.data.prompt.substring(0, 100) },
      'Image generation requested',
    )

    try {
      const options: ImageGenerationOptions = {
        style: body.data.style,
        size: body.data.size,
        quality: body.data.quality,
      }

      const result = await deps.imageService.generate(userId, body.data.prompt, options)
      const updatedQuota = deps.usageCounterRepo
        ? await deps.usageCounterRepo.increment({
            userId,
            resourceType: IMAGE_GENERATION_RESOURCE_TYPE,
          })
        : null
      const rateLimitInfo = updatedQuota
        ? {
            remaining:
              updatedQuota.limit === null
                ? null
                : Math.max(0, updatedQuota.limit - updatedQuota.count),
            resetAt: getCurrentPeriodResetAt(),
          }
        : result.rateLimitInfo
      if (rateLimitInfo?.remaining !== null && rateLimitInfo?.remaining !== undefined) {
        c.header('X-RateLimit-Remaining', String(rateLimitInfo.remaining))
      }
      if (rateLimitInfo?.resetAt) {
        c.header('X-RateLimit-Reset', String(rateLimitInfo.resetAt))
      }

      deps.logger.info(
        { userId, provider: result.provider, hasImage: Boolean(result.image.base64 || result.image.url) },
        'Image generated successfully',
      )

      // Return image data
      if (result.image.base64) {
        return c.json({
          success: true,
          image: {
            base64: result.image.base64,
            mimeType: result.image.mimeType ?? 'image/png',
          },
          provider: result.provider,
          rateLimitInfo,
        })
      }

      if (result.image.url) {
        return c.json({
          success: true,
          image: {
            url: result.image.url,
          },
          provider: result.provider,
          revisedPrompt: result.image.revisedPrompt,
          rateLimitInfo,
        })
      }

      return c.json({ error: 'no_image_generated' }, 500)
    } catch (error) {
      if (error instanceof RateLimitExceededError) {
        c.header('X-RateLimit-Remaining', '0')
        c.header('X-RateLimit-Reset', String(error.rateLimitInfo.resetAt))

        return c.json(
          {
            error: 'rate_limit_exceeded',
            message: 'You have reached your daily image generation limit',
            resetAt: error.rateLimitInfo.resetAt,
          },
          429,
        )
      }

      deps.logger.error({ error, userId }, 'Image generation failed')

      return c.json(
        {
          error: 'generation_failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500,
      )
    }
  })

  /**
   * GET /quota
   * Get current image generation quota status
   */
  app.get('/quota', async (c) => {
    const userId = c.get('userId') as string | undefined
    if (!userId) {
      return c.json({ error: 'unauthorized' }, 401)
    }

    const subscriptionGate = await requireActiveSubscription(userId, deps.subscriptionRepo)
    if (subscriptionGate) {
      return c.json(subscriptionGate.body, subscriptionGate.status)
    }

    if (!deps.usageCounterRepo) {
      return c.json({
        available: true,
        remaining: IMAGE_GENERATION_MONTHLY_LIMIT,
        used: 0,
        limit: IMAGE_GENERATION_MONTHLY_LIMIT,
        resetAt: getCurrentPeriodResetAt(),
      })
    }

    const quota = await ensureImageGenerationQuota(userId, deps.usageCounterRepo)
    if (!quota) {
      return c.json({
        available: true,
        remaining: IMAGE_GENERATION_MONTHLY_LIMIT,
        used: 0,
        limit: IMAGE_GENERATION_MONTHLY_LIMIT,
        resetAt: getCurrentPeriodResetAt(),
      })
    }

    return c.json({
      available: quota.available,
      remaining: quota.remaining,
      used: quota.used,
      limit: quota.limit,
      resetAt: getCurrentPeriodResetAt(),
    })
  })

  return app
}

async function requireActiveSubscription(
  userId: string,
  subscriptionRepo: SubscriptionRepository | undefined,
): Promise<
  | {
      status: 403
      body: {
        success: false
        error: {
          code: 'SUBSCRIPTION_REQUIRED'
          message: string
        }
      }
    }
  | null
> {
  if (!subscriptionRepo) {
    return null
  }

  const hasActiveSubscription = await subscriptionRepo.isActive(userId)
  if (hasActiveSubscription) {
    return null
  }

  return {
    status: 403,
    body: {
      success: false,
      error: {
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'Ative sua assinatura para usar este recurso.',
      },
    },
  }
}

async function ensureImageGenerationQuota(
  userId: string,
  usageCounterRepo: UsageCounterRepository | undefined,
) {
  if (!usageCounterRepo) {
    return null
  }

  const currentUsage = await usageCounterRepo.getUsage({
    userId,
    resourceType: IMAGE_GENERATION_RESOURCE_TYPE,
  })

  if (!currentUsage || currentUsage.limitValue !== IMAGE_GENERATION_MONTHLY_LIMIT) {
    await usageCounterRepo.setLimit({
      userId,
      resourceType: IMAGE_GENERATION_RESOURCE_TYPE,
      limit: IMAGE_GENERATION_MONTHLY_LIMIT,
    })
  }

  return usageCounterRepo.hasQuota({
    userId,
    resourceType: IMAGE_GENERATION_RESOURCE_TYPE,
  })
}

function getCurrentPeriodResetAt(): number {
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return nextMonth.getTime()
}

function parseGenerateRequest(body: unknown):
  | {
      success: true
      data: {
        prompt: string
        style: ImageStyle
        size: ImageSize
        quality: ImageQuality
      }
    }
  | {
      success: false
      error: {
        error: 'validation_error'
        message: string
        details: Array<{
          field: string
          message: string
          code: string
        }>
      }
    } {
  if (!body || typeof body !== 'object') {
    return validationError('body', 'Invalid JSON in request body', 'invalid_json')
  }

  const record = body as Record<string, unknown>
  const prompt =
    typeof record.prompt === 'string'
      ? record.prompt.trim()
      : ''

  if (prompt.length === 0) {
    return validationError('prompt', 'Prompt is required', 'too_small')
  }

  if (prompt.length > 1000) {
    return validationError('prompt', 'Prompt must be at most 1000 characters', 'too_big')
  }

  const style = parseEnumValue(record.style, IMAGE_STYLES, 'vivid')
  if (!style.success) {
    return validationError('style', 'Style must be vivid or natural', 'invalid_enum_value')
  }

  const size = parseEnumValue(record.size, IMAGE_SIZES, '1024x1024')
  if (!size.success) {
    return validationError(
      'size',
      'Size must be 256x256, 512x512, or 1024x1024',
      'invalid_enum_value',
    )
  }

  const quality = parseEnumValue(record.quality, IMAGE_QUALITIES, 'standard')
  if (!quality.success) {
    return validationError('quality', 'Quality must be standard or hd', 'invalid_enum_value')
  }

  return {
    success: true,
    data: {
      prompt,
      style: style.value,
      size: size.value,
      quality: quality.value,
    },
  }
}

function parseEnumValue<T extends string>(
  value: unknown,
  allowedValues: ReadonlySet<T>,
  fallback: T,
): { success: true; value: T } | { success: false } {
  if (value === undefined) {
    return { success: true, value: fallback }
  }

  if (typeof value !== 'string') {
    return { success: false }
  }

  return allowedValues.has(value as T)
    ? { success: true, value: value as T }
    : { success: false }
}

function validationError(field: string, message: string, code: string) {
  return {
    success: false as const,
    error: {
      error: 'validation_error' as const,
      message: 'Invalid request data',
      details: [
        {
          field,
          message,
          code,
        },
      ],
    },
  }
}
