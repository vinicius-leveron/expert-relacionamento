import { createHash, randomBytes } from 'node:crypto'
import type { MagicLink } from './auth.types.js'
import { AuthError } from './auth.types.js'

export interface MagicLinkRepository {
  create(data: {
    email: string
    tokenHash: string
    expiresAt: Date
  }): Promise<MagicLink>

  findByTokenHash(tokenHash: string): Promise<MagicLink | null>

  markAsUsed(id: string): Promise<void>

  deleteExpired(): Promise<void>
}

export interface EmailSender {
  sendMagicLink(email: string, link: string): Promise<void>
}

export interface MagicLinkServiceConfig {
  baseUrl: string
  expiresInMinutes?: number // default 15 min
}

/**
 * MagicLinkService - Autenticação passwordless via email
 *
 * Fluxo:
 * 1. Usuário solicita login com email
 * 2. Gera token único, salva hash no banco
 * 3. Envia email com link contendo token
 * 4. Usuário clica no link
 * 5. Valida token, marca como usado
 * 6. Retorna/cria usuário e gera JWT
 */
export class MagicLinkService {
  private readonly baseUrl: string
  private readonly expiresInMs: number

  constructor(
    private readonly repo: MagicLinkRepository,
    private readonly emailSender: EmailSender,
    config: MagicLinkServiceConfig
  ) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.expiresInMs = (config.expiresInMinutes ?? 15) * 60 * 1000
  }

  /**
   * Gera e envia magic link para o email
   * Retorna o link (útil para testes em dev)
   */
  async sendMagicLink(email: string): Promise<string> {
    const normalizedEmail = email.toLowerCase().trim()

    // Gera token seguro (32 bytes = 256 bits)
    const token = randomBytes(32).toString('base64url')
    const tokenHash = this.hashToken(token)

    // Salva no banco
    await this.repo.create({
      email: normalizedEmail,
      tokenHash,
      expiresAt: new Date(Date.now() + this.expiresInMs),
    })

    // Monta link e envia email
    const link = `${this.baseUrl}/verify?token=${token}`
    await this.emailSender.sendMagicLink(normalizedEmail, link)

    return link
  }

  /**
   * Valida token e retorna email do usuário
   */
  async verifyToken(token: string): Promise<string> {
    const tokenHash = this.hashToken(token)
    const magicLink = await this.repo.findByTokenHash(tokenHash)

    if (!magicLink) {
      throw new AuthError('Invalid magic link', 'invalid_magic_link')
    }

    if (magicLink.usedAt) {
      throw new AuthError('Magic link already used', 'magic_link_used')
    }

    if (new Date() > magicLink.expiresAt) {
      throw new AuthError('Magic link expired', 'magic_link_expired')
    }

    // Marca como usado
    await this.repo.markAsUsed(magicLink.id)

    return magicLink.email
  }

  /**
   * Hash do token para armazenamento seguro
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }
}
