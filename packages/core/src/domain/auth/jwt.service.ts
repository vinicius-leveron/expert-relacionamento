import { createHash, randomUUID } from 'node:crypto'
import * as jose from 'jose'
import type { AuthTokens, RefreshTokenPayload, TokenPayload } from './auth.types.js'
import { AuthError } from './auth.types.js'

export interface JwtServiceConfig {
  secret: string
  accessTokenExpiresIn?: number // seconds, default 15 min
  refreshTokenExpiresIn?: number // seconds, default 30 days
  issuer?: string
}

/**
 * JwtService - Geração e validação de tokens JWT
 *
 * Access Token: Curta duração (15 min), contém dados do usuário
 * Refresh Token: Longa duração (30 dias), apenas IDs para revogação
 */
export class JwtService {
  private readonly secret: Uint8Array
  private readonly accessTokenExpiresIn: number
  private readonly refreshTokenExpiresIn: number
  private readonly issuer: string

  constructor(config: JwtServiceConfig) {
    this.secret = new TextEncoder().encode(config.secret)
    this.accessTokenExpiresIn = config.accessTokenExpiresIn ?? 15 * 60 // 15 min
    this.refreshTokenExpiresIn = config.refreshTokenExpiresIn ?? 30 * 24 * 60 * 60 // 30 days
    this.issuer = config.issuer ?? 'perpetuo'
  }

  /**
   * Gera par de tokens (access + refresh)
   */
  async generateTokens(user: {
    id: string
    email: string | null
    phoneE164: string | null
  }): Promise<{ tokens: AuthTokens; sessionId: string }> {
    const sessionId = randomUUID()
    const now = Math.floor(Date.now() / 1000)

    // Access token - dados do usuário
    const accessToken = await new jose.SignJWT({
      sub: user.id,
      email: user.email,
      phone: user.phoneE164,
    } satisfies Omit<TokenPayload, 'iat' | 'exp'>)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(now)
      .setExpirationTime(now + this.accessTokenExpiresIn)
      .setIssuer(this.issuer)
      .sign(this.secret)

    // Refresh token - apenas IDs
    const refreshToken = await new jose.SignJWT({
      sub: user.id,
      jti: sessionId,
    } satisfies Omit<RefreshTokenPayload, 'iat' | 'exp'>)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(now)
      .setExpirationTime(now + this.refreshTokenExpiresIn)
      .setIssuer(this.issuer)
      .sign(this.secret)

    return {
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: this.accessTokenExpiresIn,
      },
      sessionId,
    }
  }

  /**
   * Valida access token e retorna payload
   */
  async verifyAccessToken(token: string): Promise<TokenPayload> {
    try {
      const { payload } = await jose.jwtVerify(token, this.secret, {
        issuer: this.issuer,
      })

      return {
        sub: payload.sub as string,
        email: (payload.email as string | null) ?? null,
        phone: (payload.phone as string | null) ?? null,
        iat: payload.iat as number,
        exp: payload.exp as number,
      }
    } catch (error) {
      if (error instanceof jose.errors.JWTExpired) {
        throw new AuthError('Token expired', 'token_expired')
      }
      throw new AuthError('Invalid token', 'invalid_token')
    }
  }

  /**
   * Valida refresh token e retorna payload
   */
  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      const { payload } = await jose.jwtVerify(token, this.secret, {
        issuer: this.issuer,
      })

      return {
        sub: payload.sub as string,
        jti: payload.jti as string,
        iat: payload.iat as number,
        exp: payload.exp as number,
      }
    } catch (error) {
      if (error instanceof jose.errors.JWTExpired) {
        throw new AuthError('Token expired', 'token_expired')
      }
      throw new AuthError('Invalid token', 'invalid_token')
    }
  }

  /**
   * Hash do refresh token para armazenamento seguro
   */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  /**
   * Calcula data de expiração do refresh token
   */
  getRefreshTokenExpiration(): Date {
    return new Date(Date.now() + this.refreshTokenExpiresIn * 1000)
  }
}
