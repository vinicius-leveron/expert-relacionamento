import type { Context, Next, MiddlewareHandler } from 'hono'

interface RateLimitOptions {
  windowMs: number // Time window in milliseconds
  max: number // Max requests per window
  keyGenerator?: (c: Context) => string
  message?: string
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store - use Redis in production for multi-instance
const store = new Map<string, RateLimitEntry>()

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.resetTime < now) {
      store.delete(key)
    }
  }
}, 60000) // Every minute

const defaultKeyGenerator = (c: Context): string => {
  // Try to get user ID from auth context
  const userId = c.get('userId')
  if (userId) return `user:${userId}`

  // Fall back to IP
  const forwarded = c.req.header('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'unknown'
  return `ip:${ip}`
}

/**
 * Rate limiting middleware
 *
 * Usage:
 * app.use('/api/*', rateLimit({ windowMs: 60000, max: 100 }))
 */
export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  const { windowMs, max, keyGenerator = defaultKeyGenerator, message = 'Too many requests' } = options

  return async (c: Context, next: Next) => {
    const key = keyGenerator(c)
    const now = Date.now()

    let entry = store.get(key)

    // Initialize or reset if window expired
    if (!entry || entry.resetTime < now) {
      entry = {
        count: 0,
        resetTime: now + windowMs,
      }
    }

    entry.count++
    store.set(key, entry)

    // Set headers
    const remaining = Math.max(0, max - entry.count)
    c.header('X-RateLimit-Limit', String(max))
    c.header('X-RateLimit-Remaining', String(remaining))
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetTime / 1000)))

    // Check if over limit
    if (entry.count > max) {
      c.header('Retry-After', String(Math.ceil((entry.resetTime - now) / 1000)))
      return c.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message,
          },
        },
        429
      )
    }

    await next()
  }
}

/**
 * Stricter rate limit for auth endpoints
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  message: 'Too many authentication attempts. Please try again later.',
})

/**
 * Standard API rate limit
 */
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
})

/**
 * Webhook rate limit (more permissive)
 */
export const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  keyGenerator: (c) => {
    // Use webhook source as key
    const source = c.req.header('x-webhook-source') || 'unknown'
    return `webhook:${source}`
  },
})
