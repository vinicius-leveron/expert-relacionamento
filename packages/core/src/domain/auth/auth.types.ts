/**
 * Auth Types - Tipos para autenticação JWT e Magic Link
 */

export interface TokenPayload {
  sub: string // user_id
  email: string | null
  phone: string | null
  iat: number // issued at (timestamp)
  exp: number // expires at (timestamp)
}

export interface RefreshTokenPayload {
  sub: string // user_id
  jti: string // session_id (for revocation)
  iat: number
  exp: number
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number // seconds until access token expires
}

export interface Session {
  id: string
  userId: string
  refreshTokenHash: string
  deviceInfo: DeviceInfo
  expiresAt: Date
  createdAt: Date
  revokedAt: Date | null
}

export interface DeviceInfo {
  userAgent?: string
  ip?: string
  platform?: string
}

export interface MagicLink {
  id: string
  email: string
  tokenHash: string
  expiresAt: Date
  usedAt: Date | null
  createdAt: Date
}

export interface VerificationCode {
  id: string
  userId: string
  code: string
  purpose: 'link_whatsapp' | 'verify_email'
  expiresAt: Date
  usedAt: Date | null
  createdAt: Date
}

// Auth errors
export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: AuthErrorCode
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export type AuthErrorCode =
  | 'invalid_token'
  | 'token_expired'
  | 'session_revoked'
  | 'invalid_magic_link'
  | 'magic_link_expired'
  | 'magic_link_used'
  | 'invalid_verification_code'
  | 'verification_code_expired'
