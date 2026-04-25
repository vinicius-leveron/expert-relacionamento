import { User, type UserRepository } from '@perpetuo/core'

/**
 * MockUserRepository - In-memory repository para desenvolvimento sem Supabase
 */
export function createMockUserRepository(): UserRepository {
  const users = new Map<string, User>()

  return {
    async findById(id: string): Promise<User | null> {
      return users.get(id) ?? null
    },

    async findByPhone(phoneE164: string): Promise<User | null> {
      for (const user of users.values()) {
        if (user.phoneE164 === phoneE164) {
          return user
        }
      }
      return null
    },

    async findByEmail(email: string): Promise<User | null> {
      for (const user of users.values()) {
        if (user.email === email) {
          return user
        }
      }
      return null
    },

    async save(user: User): Promise<void> {
      users.set(user.id, user)
    },

    async findOrCreateByPhone(phoneE164: string): Promise<User> {
      const existing = await this.findByPhone(phoneE164)
      if (existing) {
        return existing
      }

      const user = User.create({ phoneE164 })
      await this.save(user)
      return user
    },
  }
}
