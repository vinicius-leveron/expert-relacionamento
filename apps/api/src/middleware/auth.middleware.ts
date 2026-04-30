import type { Context, MiddlewareHandler, Next } from 'hono'
import { AuthError, JwtService, type TokenPayload } from '@perpetuo/core'

// Extend Hono's context to include auth data
declare module 'hono' {
  interface ContextVariableMap {
    userId: string
    userEmail: string | null
    userPhone: string | null
    tokenPayload: TokenPayload
  }
}

export interface AuthMiddlewareConfig {
  jwtService: JwtService
}

/**
 * Creates JWT authentication middleware for protected routes
 */
export function createAuthMiddleware(config: AuthMiddlewareConfig): MiddlewareHandler {
  const { jwtService } = config

  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization')

    if (!authHeader) {
      return c.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authorization header is required',
          },
        },
        401
      )
    }

    if (!authHeader.startsWith('Bearer ')) {
      return c.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid authorization format. Use: Bearer <token>',
          },
        },
        401
      )
    }

    const token = authHeader.slice(7) // Remove "Bearer "

    try {
      const payload = await jwtService.verifyAccessToken(token)

      // Set user info in context for route handlers
      c.set('userId', payload.sub)
      c.set('userEmail', payload.email)
      c.set('userPhone', payload.phone)
      c.set('tokenPayload', payload)

      await next()
    } catch (error) {
      if (error instanceof AuthError) {
        const status = error.code === 'token_expired' ? 401 : 401
        return c.json(
          {
            success: false,
            error: {
              code: error.code.toUpperCase(),
              message: error.message,
            },
          },
          status
        )
      }

      return c.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid token',
          },
        },
        401
      )
    }
  }
}

/**
 * Optional auth middleware - doesn't fail if no token, just sets context if present
 */
export function createOptionalAuthMiddleware(config: AuthMiddlewareConfig): MiddlewareHandler {
  const { jwtService } = config

  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization')

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)

      try {
        const payload = await jwtService.verifyAccessToken(token)
        c.set('userId', payload.sub)
        c.set('userEmail', payload.email)
        c.set('userPhone', payload.phone)
        c.set('tokenPayload', payload)
      } catch {
        // Ignore auth errors - user is simply not authenticated
      }
    }

    await next()
  }
}
