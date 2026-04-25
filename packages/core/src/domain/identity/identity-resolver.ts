import type { User } from '../user/user.entity.js'
import type { UserRepository } from '../user/user.repository.js'

export interface IdentitySource {
  type: 'phone' | 'email'
  value: string
}

/**
 * IdentityResolver - Resolve identidades externas para user_id interno (ADR 0011)
 * Usado no início do pipeline de webhook
 */
export class IdentityResolver {
  constructor(private readonly userRepo: UserRepository) {}

  async resolve(source: IdentitySource): Promise<User> {
    if (source.type === 'phone') {
      return this.userRepo.findOrCreateByPhone(source.value)
    }

    // Email lookup (para webhook de pagamento)
    const existing = await this.userRepo.findByEmail(source.value)
    if (existing) {
      return existing
    }

    // Email sem usuário existente - criar novo
    // (raro: normalmente o usuário já existe via WhatsApp)
    const { User } = await import('../user/user.entity.js')
    const user = User.create({ email: source.value })
    await this.userRepo.save(user)
    return user
  }
}
