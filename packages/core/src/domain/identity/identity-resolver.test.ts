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
      findOrCreateByEmail: vi.fn(),
      linkEmail: vi.fn(),
      linkPhone: vi.fn(),
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
    it('should delegate to findOrCreateByEmail', async () => {
      const existingUser = User.create({ email: 'test@example.com' })
      vi.mocked(mockUserRepo.findOrCreateByEmail).mockResolvedValue(existingUser)

      const result = await resolver.resolve({
        type: 'email',
        value: 'test@example.com',
      })

      expect(mockUserRepo.findOrCreateByEmail).toHaveBeenCalledWith('test@example.com')
      expect(result.id).toBe(existingUser.id)
    })
  })

  describe('resolve with user_id', () => {
    it('should find user by id', async () => {
      const existingUser = User.create({ email: 'test@example.com' })
      vi.mocked(mockUserRepo.findById).mockResolvedValue(existingUser)

      const result = await resolver.resolve({
        type: 'user_id',
        value: existingUser.id,
      })

      expect(mockUserRepo.findById).toHaveBeenCalledWith(existingUser.id)
      expect(result.id).toBe(existingUser.id)
    })

    it('should throw if user not found', async () => {
      vi.mocked(mockUserRepo.findById).mockResolvedValue(null)

      await expect(
        resolver.resolve({
          type: 'user_id',
          value: 'non-existent-id',
        }),
      ).rejects.toThrow('User not found')
    })
  })
})
