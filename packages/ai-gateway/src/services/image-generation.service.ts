import type {
  ImageGenerationPort,
  ImageGenerationOptions,
  GeneratedImage,
} from '../ports/image-generation.port.js'

export interface ImageGenerationServiceConfig {
  primaryAdapter: ImageGenerationPort
  fallbackAdapter?: ImageGenerationPort
  rateLimiter?: RateLimiter
}

export interface RateLimiter {
  checkLimit(userId: string): Promise<{
    allowed: boolean
    remaining: number
    resetAt: number
  }>
  recordUsage(userId: string): Promise<void>
}

/**
 * Image generation service with fallback and rate limiting
 */
export class ImageGenerationService {
  constructor(private readonly config: ImageGenerationServiceConfig) {}

  /**
   * Generate an image with optional rate limiting and fallback
   */
  async generate(
    userId: string,
    prompt: string,
    options?: ImageGenerationOptions,
  ): Promise<{
    image: GeneratedImage
    provider: string
    rateLimitInfo?: {
      remaining: number
      resetAt: number
    }
  }> {
    // Check rate limit if limiter is configured
    if (this.config.rateLimiter) {
      const limitResult = await this.config.rateLimiter.checkLimit(userId)

      if (!limitResult.allowed) {
        throw new RateLimitExceededError({
          remaining: 0,
          resetAt: limitResult.resetAt,
        })
      }
    }

    // Try primary adapter
    try {
      const image = await this.config.primaryAdapter.generate(prompt, options)

      // Record usage after successful generation
      if (this.config.rateLimiter) {
        await this.config.rateLimiter.recordUsage(userId)
      }

      // Get updated rate limit info
      let rateLimitInfo
      if (this.config.rateLimiter) {
        const limitResult = await this.config.rateLimiter.checkLimit(userId)
        rateLimitInfo = {
          remaining: limitResult.remaining,
          resetAt: limitResult.resetAt,
        }
      }

      return {
        image,
        provider: this.config.primaryAdapter.providerName,
        rateLimitInfo,
      }
    } catch (error) {
      // If fallback available, try it
      if (this.config.fallbackAdapter) {
        console.warn(
          `Primary image generation failed (${this.config.primaryAdapter.providerName}), trying fallback:`,
          error,
        )

        const image = await this.config.fallbackAdapter.generate(prompt, options)

        // Record usage after successful generation
        if (this.config.rateLimiter) {
          await this.config.rateLimiter.recordUsage(userId)
        }

        // Get updated rate limit info
        let rateLimitInfo
        if (this.config.rateLimiter) {
          const limitResult = await this.config.rateLimiter.checkLimit(userId)
          rateLimitInfo = {
            remaining: limitResult.remaining,
            resetAt: limitResult.resetAt,
          }
        }

        return {
          image,
          provider: this.config.fallbackAdapter.providerName,
          rateLimitInfo,
        }
      }

      // No fallback, rethrow
      throw error
    }
  }

  /**
   * Get available providers
   */
  getProviders(): string[] {
    const providers = [this.config.primaryAdapter.providerName]
    if (this.config.fallbackAdapter) {
      providers.push(this.config.fallbackAdapter.providerName)
    }
    return providers
  }
}

/**
 * Error thrown when rate limit is exceeded
 */
export class RateLimitExceededError extends Error {
  constructor(
    public readonly rateLimitInfo: {
      remaining: number
      resetAt: number
    },
  ) {
    super('Rate limit exceeded for image generation')
    this.name = 'RateLimitExceededError'
  }
}

/**
 * Simple in-memory rate limiter for development
 * Use Redis-based limiter in production
 */
export class InMemoryRateLimiter implements RateLimiter {
  private usageMap = new Map<string, { count: number; windowStart: number }>()

  constructor(
    private config: {
      maxRequests: number
      windowMs: number
    },
  ) {}

  async checkLimit(userId: string): Promise<{
    allowed: boolean
    remaining: number
    resetAt: number
  }> {
    const now = Date.now()
    const key = userId
    const usage = this.usageMap.get(key)

    // No usage record or window expired
    if (!usage || now - usage.windowStart >= this.config.windowMs) {
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetAt: now + this.config.windowMs,
      }
    }

    const remaining = this.config.maxRequests - usage.count
    const resetAt = usage.windowStart + this.config.windowMs

    return {
      allowed: remaining > 0,
      remaining: Math.max(0, remaining - 1),
      resetAt,
    }
  }

  async recordUsage(userId: string): Promise<void> {
    const now = Date.now()
    const key = userId
    const usage = this.usageMap.get(key)

    if (!usage || now - usage.windowStart >= this.config.windowMs) {
      // New window
      this.usageMap.set(key, { count: 1, windowStart: now })
    } else {
      // Increment in current window
      usage.count++
    }
  }

  /**
   * Clear all usage records (for testing)
   */
  clear(): void {
    this.usageMap.clear()
  }
}

/**
 * Rate limit configurations by plan
 */
export const ImageRateLimits = {
  free: {
    maxRequests: 3,
    windowMs: 24 * 60 * 60 * 1000, // 3 per day
  },
  basic: {
    maxRequests: 10,
    windowMs: 24 * 60 * 60 * 1000, // 10 per day
  },
  premium: {
    maxRequests: 30,
    windowMs: 24 * 60 * 60 * 1000, // 30 per day
  },
} as const
