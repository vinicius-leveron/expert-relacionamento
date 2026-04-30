import type { User } from '../user/user.entity.js'
import type { UserRepository } from '../user/user.repository.js'

export interface IdentitySource {
  type: 'phone' | 'email' | 'user_id'
  value: string
}

/**
 * IdentityResolver - Resolve identidades externas para user_id interno (ADR 0011)
 *
 * Tipos de identidade:
 * - phone: Usado pelo WhatsApp webhook
 * - email: Usado pelo app via magic link
 * - user_id: Usado quando o JWT já validou a identidade (app autenticado)
 */
export class IdentityResolver {
  constructor(private readonly userRepo: UserRepository) {}

  async resolve(source: IdentitySource): Promise<User> {
    if (source.type === 'phone') {
      return this.userRepo.findOrCreateByPhone(source.value)
    }

    if (source.type === 'user_id') {
      // JWT já validou a identidade, apenas buscar usuário
      const user = await this.userRepo.findById(source.value)
      if (!user) {
        throw new Error(`User not found: ${source.value}`)
      }
      return user
    }

    // Email lookup/create (para app via magic link)
    return this.userRepo.findOrCreateByEmail(source.value)
  }
}
