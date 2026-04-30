import { Hono } from 'hono'
import type { UserRepository, JwtService, MagicLinkService, VerificationCodeService } from '@perpetuo/core'
import type { SupabaseSessionRepository } from '@perpetuo/database'
import type { Logger } from 'pino'
import { isEmailDeliveryConfigured } from '../../services/email.service.js'

export interface AuthRoutesConfig {
  jwtService: JwtService
  magicLinkService: MagicLinkService
  verificationCodeService: VerificationCodeService
  sessionRepo: SupabaseSessionRepository
  userRepo: UserRepository
  logger: Logger
}

export function createAuthRoutes(config: AuthRoutesConfig) {
  const { jwtService, magicLinkService, verificationCodeService, sessionRepo, userRepo, logger } = config
  const app = new Hono()

  /**
   * POST /magic-link
   * Envia magic link por email
   */
  app.post('/magic-link', async (c) => {
    const body = await c.req.json<{ email?: string }>()
    const isProduction = process.env.NODE_ENV === 'production'
    const hasEmailDelivery = isEmailDeliveryConfigured()

    if (!body.email || typeof body.email !== 'string') {
      return c.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Email is required' },
        },
        400
      )
    }

    const email = body.email.toLowerCase().trim()

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return c.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid email format' },
        },
        400
      )
    }

    if (isProduction && !hasEmailDelivery) {
      logger.error({ email }, 'Magic link requested without email delivery configured')
      return c.json(
        {
          success: false,
          error: {
            code: 'EMAIL_NOT_CONFIGURED',
            message: 'O login por email não está configurado em produção.',
          },
        },
        503,
      )
    }

    try {
      const link = await magicLinkService.sendMagicLink(email)
      logger.info(
        { email, hasEmailDelivery },
        hasEmailDelivery
          ? 'Magic link sent'
          : 'Magic link generated without email delivery configured'
      )

      // Em desenvolvimento, retorna o link para facilitar testes
      const shouldReturnDevLink = !isProduction

      return c.json({
        success: true,
        data: {
          message: hasEmailDelivery
            ? 'Magic link sent to your email'
            : 'Magic link generated for direct browser login',
          ...(shouldReturnDevLink && { devLink: link }),
        },
      })
    } catch (error) {
      logger.error({ error, email }, 'Failed to send magic link')
      return c.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to send magic link' },
        },
        500
      )
    }
  })

  /**
   * POST /verify
   * Verifica token do magic link e retorna JWT
   */
  app.post('/verify', async (c) => {
    const body = await c.req.json<{ token?: string }>()

    if (!body.token || typeof body.token !== 'string') {
      return c.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Token is required' },
        },
        400
      )
    }

    try {
      // Verify magic link and get email
      const email = await magicLinkService.verifyToken(body.token)

      // Find or create user
      const user = await userRepo.findOrCreateByEmail(email)

      // Generate JWT tokens
      const { tokens, sessionId } = await jwtService.generateTokens({
        id: user.id,
        email: user.email,
        phoneE164: user.phoneE164,
      })

      // Save session
      const deviceInfo = {
        userAgent: c.req.header('User-Agent'),
        ip: c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP'),
      }

      await sessionRepo.create({
        userId: user.id,
        refreshTokenHash: jwtService.hashToken(tokens.refreshToken),
        deviceInfo,
        expiresAt: jwtService.getRefreshTokenExpiration(),
      })

      logger.info({ userId: user.id, email }, 'User authenticated via magic link')

      return c.json({
        success: true,
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
          user: {
            id: user.id,
            email: user.email,
            phone: user.phoneE164,
          },
        },
      })
    } catch (error) {
      const err = error as Error
      logger.warn({ error: err.message }, 'Magic link verification failed')

      return c.json(
        {
          success: false,
          error: { code: 'INVALID_TOKEN', message: err.message },
        },
        401
      )
    }
  })

  /**
   * POST /refresh
   * Renova access token usando refresh token
   */
  app.post('/refresh', async (c) => {
    const body = await c.req.json<{ refreshToken?: string }>()

    if (!body.refreshToken || typeof body.refreshToken !== 'string') {
      return c.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Refresh token is required' },
        },
        400
      )
    }

    try {
      // Verify refresh token
      const payload = await jwtService.verifyRefreshToken(body.refreshToken)

      // Check if session exists and is valid
      const tokenHash = jwtService.hashToken(body.refreshToken)
      const session = await sessionRepo.findByTokenHash(tokenHash)

      if (!session) {
        return c.json(
          {
            success: false,
            error: { code: 'SESSION_REVOKED', message: 'Session has been revoked' },
          },
          401
        )
      }

      if (session.revokedAt || new Date() > session.expiresAt) {
        return c.json(
          {
            success: false,
            error: { code: 'SESSION_EXPIRED', message: 'Session has expired' },
          },
          401
        )
      }

      // Get user
      const user = await userRepo.findById(payload.sub)
      if (!user) {
        return c.json(
          {
            success: false,
            error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          },
          401
        )
      }

      // Revoke old session
      await sessionRepo.revoke(session.id)

      // Generate new tokens
      const { tokens: newTokens } = await jwtService.generateTokens({
        id: user.id,
        email: user.email,
        phoneE164: user.phoneE164,
      })

      // Save new session
      const deviceInfo = {
        userAgent: c.req.header('User-Agent'),
        ip: c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP'),
      }

      await sessionRepo.create({
        userId: user.id,
        refreshTokenHash: jwtService.hashToken(newTokens.refreshToken),
        deviceInfo,
        expiresAt: jwtService.getRefreshTokenExpiration(),
      })

      logger.info({ userId: user.id }, 'Token refreshed')

      return c.json({
        success: true,
        data: {
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
          expiresIn: newTokens.expiresIn,
        },
      })
    } catch (error) {
      const err = error as Error
      logger.warn({ error: err.message }, 'Token refresh failed')

      return c.json(
        {
          success: false,
          error: { code: 'INVALID_TOKEN', message: err.message },
        },
        401
      )
    }
  })

  /**
   * POST /logout
   * Revoga refresh token atual
   */
  app.post('/logout', async (c) => {
    const body = await c.req.json<{ refreshToken?: string }>()

    if (!body.refreshToken || typeof body.refreshToken !== 'string') {
      return c.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Refresh token is required' },
        },
        400
      )
    }

    try {
      const tokenHash = jwtService.hashToken(body.refreshToken)
      const session = await sessionRepo.findByTokenHash(tokenHash)

      if (session) {
        await sessionRepo.revoke(session.id)
        logger.info({ userId: session.userId }, 'User logged out')
      }

      return c.json({
        success: true,
        data: { message: 'Logged out successfully' },
      })
    } catch (error) {
      logger.error({ error }, 'Logout failed')
      return c.json({
        success: true,
        data: { message: 'Logged out successfully' },
      })
    }
  })

  /**
   * POST /link-whatsapp
   * Gera código para vincular WhatsApp (requer autenticação)
   */
  app.post('/link-whatsapp', async (c) => {
    const userId = c.get('userId')

    if (!userId) {
      return c.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        },
        401
      )
    }

    try {
      const code = await verificationCodeService.generateCode(userId, 'link_whatsapp')

      logger.info({ userId }, 'WhatsApp linking code generated')

      return c.json({
        success: true,
        data: {
          code,
          message: 'Envie este código para o WhatsApp do Perpétuo para vincular sua conta',
          expiresInMinutes: 5,
        },
      })
    } catch (error) {
      logger.error({ error, userId }, 'Failed to generate linking code')
      return c.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to generate code' },
        },
        500
      )
    }
  })

  return app
}
