import { randomUUID } from 'node:crypto'

export interface UserProps {
  id: string
  phoneE164: string | null
  email: string | null
  displayName?: string | null
  avatarStoragePath?: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * User Entity - ADR 0011 implementado
 * - id: UUID interno (nunca exposto em logs)
 * - phoneE164: identidade externa WhatsApp
 * - email: identidade externa app/checkout
 */
export class User {
  readonly id: string
  readonly phoneE164: string | null
  readonly email: string | null
  readonly displayName: string | null
  readonly avatarStoragePath: string | null
  readonly createdAt: Date
  readonly updatedAt: Date

  private constructor(props: UserProps) {
    this.id = props.id
    this.phoneE164 = props.phoneE164
    this.email = props.email
    this.displayName = props.displayName ?? null
    this.avatarStoragePath = props.avatarStoragePath ?? null
    this.createdAt = props.createdAt
    this.updatedAt = props.updatedAt
  }

  static create(props: {
    phoneE164?: string
    email?: string
    displayName?: string | null
    avatarStoragePath?: string | null
  }): User {
    const now = new Date()
    return new User({
      id: randomUUID(),
      phoneE164: props.phoneE164 ?? null,
      email: props.email ?? null,
      displayName: props.displayName ?? null,
      avatarStoragePath: props.avatarStoragePath ?? null,
      createdAt: now,
      updatedAt: now,
    })
  }

  static reconstitute(props: UserProps): User {
    return new User(props)
  }

  withEmail(email: string): User {
    return new User({
      ...this.toProps(),
      email,
      updatedAt: new Date(),
    })
  }

  withPhone(phoneE164: string): User {
    return new User({
      ...this.toProps(),
      phoneE164,
      updatedAt: new Date(),
    })
  }

  withProfile(params: {
    displayName?: string | null
    avatarStoragePath?: string | null
  }): User {
    return new User({
      ...this.toProps(),
      displayName:
        params.displayName !== undefined ? params.displayName : this.displayName,
      avatarStoragePath:
        params.avatarStoragePath !== undefined
          ? params.avatarStoragePath
          : this.avatarStoragePath,
      updatedAt: new Date(),
    })
  }

  toProps(): UserProps {
    return {
      id: this.id,
      phoneE164: this.phoneE164,
      email: this.email,
      displayName: this.displayName,
      avatarStoragePath: this.avatarStoragePath,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }
}
