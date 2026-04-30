import { randomInt } from 'node:crypto'
import type { VerificationCode } from './auth.types.js'
import { AuthError } from './auth.types.js'

export interface VerificationCodeRepository {
  create(data: {
    userId: string
    code: string
    purpose: 'link_whatsapp' | 'verify_email'
    expiresAt: Date
  }): Promise<VerificationCode>

  findByCode(code: string, purpose: string): Promise<VerificationCode | null>

  markAsUsed(id: string): Promise<void>

  deleteByUserId(userId: string, purpose: string): Promise<void>

  deleteExpired(): Promise<void>
}

export interface VerificationCodeServiceConfig {
  expiresInMinutes?: number // default 5 min
  codeLength?: number // default 6 digits
}

/**
 * VerificationCodeService - Códigos de verificação para vinculação de canais
 *
 * Usado para vincular conta do app com WhatsApp:
 * 1. Usuário autenticado no app solicita vinculação
 * 2. Gera código de 6 dígitos
 * 3. Usuário envia código via WhatsApp
 * 4. Backend valida e vincula phone_e164 ao user_id
 */
export class VerificationCodeService {
  private readonly expiresInMs: number
  private readonly codeLength: number

  constructor(
    private readonly repo: VerificationCodeRepository,
    config?: VerificationCodeServiceConfig
  ) {
    this.expiresInMs = (config?.expiresInMinutes ?? 5) * 60 * 1000
    this.codeLength = config?.codeLength ?? 6
  }

  /**
   * Gera código de verificação para o usuário
   */
  async generateCode(
    userId: string,
    purpose: 'link_whatsapp' | 'verify_email'
  ): Promise<string> {
    // Remove códigos anteriores do mesmo propósito
    await this.repo.deleteByUserId(userId, purpose)

    // Gera código numérico
    const min = Math.pow(10, this.codeLength - 1)
    const max = Math.pow(10, this.codeLength) - 1
    const code = randomInt(min, max + 1).toString()

    await this.repo.create({
      userId,
      code,
      purpose,
      expiresAt: new Date(Date.now() + this.expiresInMs),
    })

    return code
  }

  /**
   * Verifica código e retorna userId associado
   */
  async verifyCode(
    code: string,
    purpose: 'link_whatsapp' | 'verify_email'
  ): Promise<string> {
    const verification = await this.repo.findByCode(code, purpose)

    if (!verification) {
      throw new AuthError('Invalid verification code', 'invalid_verification_code')
    }

    if (verification.usedAt) {
      throw new AuthError('Verification code already used', 'invalid_verification_code')
    }

    if (new Date() > verification.expiresAt) {
      throw new AuthError('Verification code expired', 'verification_code_expired')
    }

    // Marca como usado
    await this.repo.markAsUsed(verification.id)

    return verification.userId
  }
}
