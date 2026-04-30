import type { User } from './user.entity.js'

export interface UserRepository {
  findById(id: string): Promise<User | null>
  findByPhone(phoneE164: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  save(user: User): Promise<void>
  findOrCreateByPhone(phoneE164: string): Promise<User>
  findOrCreateByEmail(email: string): Promise<User>
  linkPhone(userId: string, phoneE164: string): Promise<User>
}
