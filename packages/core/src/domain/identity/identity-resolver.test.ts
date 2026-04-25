import { beforeEach, describe, expect, it, vi } from 'vitest'
import { User } from '../user/user.entity.js'
import type { UserRepository } from '../user/user.repository.js'
import { IdentityResolver } from './identity-resolver.js'

describe('IdentityResolver', () => {
  let mockUserRepo: UserRepository
  let resolver: IdentityResolver

  beforeEach(() => {
    mockUserRepo = {
      findById: vi.fn(),
      findByPhone: vi.fn(),
      findByEmail: vi.fn(),
      save: vi.fn(),
      findOrCreateByPhone: vi.fn(),
    }
    resolver = new IdentityResolver(mockUserRepo)
  })

  describe('resolve with phone', () => {
    it('should delegate to findOrCreateByPhone', async () => {
      const existingUser = User.create({ phoneE164: '+5511999999999' })
      vi.mocked(mockUserRepo.findOrCreateByPhone).mockResolvedValue(existingUser)

      const result = await resolver.resolve({
        type: 'phone',
        value: '+5511999999999',
      })

      expect(mockUserRepo.findOrCreateByPhone).toHaveBeenCalledWith('+5511999999999')
      expect(result.id).toBe(existingUser.id)
    })
  })

  describe('resolve with email', () => {
    it('should return existing user if found by email', async () => {
      const existingUser = User.create({ email: 'test@example.com' })
      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(existingUser)

      const result = await resolver.resolve({
        type: 'email',
        value: 'test@example.com',
      })

      expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('test@example.com')
      expect(result.id).toBe(existingUser.id)
      expect(mockUserRepo.save).not.toHaveBeenCalled()
    })

    it('should create new user if not found by email', async () => {
      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(null)
      vi.mocked(mockUserRepo.save).mockResolvedValue()

      const result = await resolver.resolve({
        type: 'email',
        value: 'new@example.com',
      })

      expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('new@example.com')
      expect(mockUserRepo.save).toHaveBeenCalled()
      expect(result.email).toBe('new@example.com')
    })
  })
})
