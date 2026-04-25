import { describe, expect, it } from 'vitest'
import { User } from './user.entity.js'

describe('User Entity', () => {
  describe('create', () => {
    it('should create a user with phone', () => {
      const user = User.create({ phoneE164: '+5511999999999' })

      expect(user.id).toBeDefined()
      expect(user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      expect(user.phoneE164).toBe('+5511999999999')
      expect(user.email).toBeNull()
      expect(user.createdAt).toBeInstanceOf(Date)
      expect(user.updatedAt).toBeInstanceOf(Date)
    })

    it('should create a user with email', () => {
      const user = User.create({ email: 'test@example.com' })

      expect(user.email).toBe('test@example.com')
      expect(user.phoneE164).toBeNull()
    })

    it('should create a user with both phone and email', () => {
      const user = User.create({
        phoneE164: '+5511999999999',
        email: 'test@example.com',
      })

      expect(user.phoneE164).toBe('+5511999999999')
      expect(user.email).toBe('test@example.com')
    })
  })

  describe('withEmail', () => {
    it('should return a new user with updated email', () => {
      const user = User.create({ phoneE164: '+5511999999999' })
      const updated = user.withEmail('new@example.com')

      expect(updated.id).toBe(user.id)
      expect(updated.email).toBe('new@example.com')
      expect(updated.phoneE164).toBe('+5511999999999')
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(user.updatedAt.getTime())
    })
  })

  describe('withPhone', () => {
    it('should return a new user with updated phone', () => {
      const user = User.create({ email: 'test@example.com' })
      const updated = user.withPhone('+5511888888888')

      expect(updated.id).toBe(user.id)
      expect(updated.phoneE164).toBe('+5511888888888')
      expect(updated.email).toBe('test@example.com')
    })
  })

  describe('reconstitute', () => {
    it('should reconstitute a user from props', () => {
      const props = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        phoneE164: '+5511999999999',
        email: 'test@example.com',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      }

      const user = User.reconstitute(props)

      expect(user.id).toBe(props.id)
      expect(user.phoneE164).toBe(props.phoneE164)
      expect(user.email).toBe(props.email)
      expect(user.createdAt).toEqual(props.createdAt)
      expect(user.updatedAt).toEqual(props.updatedAt)
    })
  })

  describe('toProps', () => {
    it('should return all user properties', () => {
      const user = User.create({
        phoneE164: '+5511999999999',
        email: 'test@example.com',
      })

      const props = user.toProps()

      expect(props.id).toBe(user.id)
      expect(props.phoneE164).toBe(user.phoneE164)
      expect(props.email).toBe(user.email)
      expect(props.createdAt).toBe(user.createdAt)
      expect(props.updatedAt).toBe(user.updatedAt)
    })
  })
})
