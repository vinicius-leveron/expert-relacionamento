import type { UserRepository } from '@perpetuo/core'
import { User } from '@perpetuo/core'
import type { SupabaseClient } from '../client.js'

/**
 * SupabaseUserRepository - Implementação do UserRepository usando Supabase
 */
export class SupabaseUserRepository implements UserRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findById(id: string): Promise<User | null> {
    const { data, error } = await this.supabase.from('users').select('*').eq('id', id).single()

    if (error || !data) {
      return null
    }

    return User.reconstitute({
      id: data.id,
      phoneE164: data.phone_e164,
      email: data.email,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    })
  }

  async findByPhone(phoneE164: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('phone_e164', phoneE164)
      .single()

    if (error || !data) {
      return null
    }

    return User.reconstitute({
      id: data.id,
      phoneE164: data.phone_e164,
      email: data.email,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    })
  }

  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single()

    if (error || !data) {
      return null
    }

    return User.reconstitute({
      id: data.id,
      phoneE164: data.phone_e164,
      email: data.email,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    })
  }

  async save(user: User): Promise<void> {
    const props = user.toProps()

    const { error } = await this.supabase.from('users').upsert({
      id: props.id,
      phone_e164: props.phoneE164,
      email: props.email,
      created_at: props.createdAt.toISOString(),
      updated_at: props.updatedAt.toISOString(),
    })

    if (error) {
      throw new Error(`Failed to save user: ${error.message}`)
    }
  }

  async findOrCreateByPhone(phoneE164: string): Promise<User> {
    const existing = await this.findByPhone(phoneE164)
    if (existing) {
      return existing
    }

    const user = User.create({ phoneE164 })
    await this.save(user)
    return user
  }
}
