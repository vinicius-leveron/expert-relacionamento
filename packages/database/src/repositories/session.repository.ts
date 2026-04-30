import type { MagicLinkRepository, VerificationCodeRepository } from '@perpetuo/core'
import type { DeviceInfo, MagicLink, Session, VerificationCode } from '@perpetuo/core'
import type { SupabaseClient } from '../client.js'
import type { Json } from '../types.js'

/**
 * SupabaseSessionRepository - Gerencia refresh tokens
 */
export class SupabaseSessionRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(data: {
    userId: string
    refreshTokenHash: string
    deviceInfo: DeviceInfo
    expiresAt: Date
  }): Promise<Session> {
    const { data: row, error } = await this.supabase
      .from('sessions')
      .insert({
        user_id: data.userId,
        refresh_token_hash: data.refreshTokenHash,
        device_info: data.deviceInfo as Json,
        expires_at: data.expiresAt.toISOString(),
      })
      .select()
      .single()

    if (error || !row) {
      throw new Error(`Failed to create session: ${error?.message}`)
    }

    return this.mapToSession(row)
  }

  async findById(id: string): Promise<Session | null> {
    const { data, error } = await this.supabase
      .from('sessions')
      .select('*')
      .eq('id', id)
      .is('revoked_at', null)
      .single()

    if (error || !data) {
      return null
    }

    return this.mapToSession(data)
  }

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const { data, error } = await this.supabase
      .from('sessions')
      .select('*')
      .eq('refresh_token_hash', tokenHash)
      .is('revoked_at', null)
      .single()

    if (error || !data) {
      return null
    }

    return this.mapToSession(data)
  }

  async revoke(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to revoke session: ${error.message}`)
    }
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('revoked_at', null)

    if (error) {
      throw new Error(`Failed to revoke sessions: ${error.message}`)
    }
  }

  async deleteExpired(): Promise<void> {
    const { error } = await this.supabase
      .from('sessions')
      .delete()
      .or(`expires_at.lt.${new Date().toISOString()},revoked_at.not.is.null`)

    if (error) {
      throw new Error(`Failed to delete expired sessions: ${error.message}`)
    }
  }

  private mapToSession(row: Record<string, unknown>): Session {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      refreshTokenHash: row.refresh_token_hash as string,
      deviceInfo: (row.device_info as DeviceInfo) ?? {},
      expiresAt: new Date(row.expires_at as string),
      createdAt: new Date(row.created_at as string),
      revokedAt: row.revoked_at ? new Date(row.revoked_at as string) : null,
    }
  }
}

/**
 * SupabaseMagicLinkRepository - Gerencia magic links
 */
export class SupabaseMagicLinkRepository implements MagicLinkRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(data: {
    email: string
    tokenHash: string
    expiresAt: Date
  }): Promise<MagicLink> {
    const { data: row, error } = await this.supabase
      .from('magic_links')
      .insert({
        email: data.email,
        token_hash: data.tokenHash,
        expires_at: data.expiresAt.toISOString(),
      })
      .select()
      .single()

    if (error || !row) {
      throw new Error(`Failed to create magic link: ${error?.message}`)
    }

    return this.mapToMagicLink(row)
  }

  async findByTokenHash(tokenHash: string): Promise<MagicLink | null> {
    const { data, error } = await this.supabase
      .from('magic_links')
      .select('*')
      .eq('token_hash', tokenHash)
      .single()

    if (error || !data) {
      return null
    }

    return this.mapToMagicLink(data)
  }

  async markAsUsed(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('magic_links')
      .update({ used_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to mark magic link as used: ${error.message}`)
    }
  }

  async deleteExpired(): Promise<void> {
    const { error } = await this.supabase
      .from('magic_links')
      .delete()
      .or(`expires_at.lt.${new Date().toISOString()},used_at.not.is.null`)

    if (error) {
      throw new Error(`Failed to delete expired magic links: ${error.message}`)
    }
  }

  private mapToMagicLink(row: Record<string, unknown>): MagicLink {
    return {
      id: row.id as string,
      email: row.email as string,
      tokenHash: row.token_hash as string,
      expiresAt: new Date(row.expires_at as string),
      usedAt: row.used_at ? new Date(row.used_at as string) : null,
      createdAt: new Date(row.created_at as string),
    }
  }
}

/**
 * SupabaseVerificationCodeRepository - Gerencia códigos de verificação
 */
export class SupabaseVerificationCodeRepository implements VerificationCodeRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(data: {
    userId: string
    code: string
    purpose: 'link_whatsapp' | 'verify_email'
    expiresAt: Date
  }): Promise<VerificationCode> {
    const { data: row, error } = await this.supabase
      .from('verification_codes')
      .insert({
        user_id: data.userId,
        code: data.code,
        purpose: data.purpose,
        expires_at: data.expiresAt.toISOString(),
      })
      .select()
      .single()

    if (error || !row) {
      throw new Error(`Failed to create verification code: ${error?.message}`)
    }

    return this.mapToVerificationCode(row)
  }

  async findByCode(code: string, purpose: string): Promise<VerificationCode | null> {
    const { data, error } = await this.supabase
      .from('verification_codes')
      .select('*')
      .eq('code', code)
      .eq('purpose', purpose)
      .is('used_at', null)
      .single()

    if (error || !data) {
      return null
    }

    return this.mapToVerificationCode(data)
  }

  async markAsUsed(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('verification_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to mark verification code as used: ${error.message}`)
    }
  }

  async deleteByUserId(userId: string, purpose: string): Promise<void> {
    const { error } = await this.supabase
      .from('verification_codes')
      .delete()
      .eq('user_id', userId)
      .eq('purpose', purpose)

    if (error) {
      throw new Error(`Failed to delete verification codes: ${error.message}`)
    }
  }

  async deleteExpired(): Promise<void> {
    const { error } = await this.supabase
      .from('verification_codes')
      .delete()
      .or(`expires_at.lt.${new Date().toISOString()},used_at.not.is.null`)

    if (error) {
      throw new Error(`Failed to delete expired verification codes: ${error.message}`)
    }
  }

  private mapToVerificationCode(row: Record<string, unknown>): VerificationCode {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      code: row.code as string,
      purpose: row.purpose as 'link_whatsapp' | 'verify_email',
      expiresAt: new Date(row.expires_at as string),
      usedAt: row.used_at ? new Date(row.used_at as string) : null,
      createdAt: new Date(row.created_at as string),
    }
  }
}
