import type { SupabaseClient } from '../client.js'
import type { Json } from '../types.js'

export type AvatarProfileStatus = 'not_started' | 'in_progress' | 'completed'

export interface AvatarPhaseSnapshot {
  title?: string
  summary: string
  extractedSignals: string[]
  rawAnswers: string[]
  updatedAt: string
}

export interface AvatarProfileIdentitySummary {
  selfImage: string
  idealSelf: string
  mainConflict: string
}

export interface AvatarProfileSummary {
  identity: AvatarProfileIdentitySummary
  socialRomanticPatterns: string[]
  strengths: string[]
  blockers: string[]
  values: string[]
  goals90d: string[]
  executionRisks: string[]
  recommendedNextFocus: string
}

export interface AvatarProfile {
  id: string
  userId: string
  status: AvatarProfileStatus
  currentPhase: number | null
  completedPhases: number[]
  phaseData: Record<string, AvatarPhaseSnapshot>
  profileSummary: AvatarProfileSummary
  sourceConversationId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface AvatarProfileRepository {
  getByUserId(userId: string): Promise<AvatarProfile | null>
  upsert(params: {
    userId: string
    status: AvatarProfileStatus
    currentPhase: number | null
    completedPhases: number[]
    phaseData: Record<string, AvatarPhaseSnapshot>
    profileSummary: AvatarProfileSummary
    sourceConversationId?: string | null
  }): Promise<AvatarProfile>
}

export function createEmptyAvatarProfileSummary(): AvatarProfileSummary {
  return {
    identity: {
      selfImage: '',
      idealSelf: '',
      mainConflict: '',
    },
    socialRomanticPatterns: [],
    strengths: [],
    blockers: [],
    values: [],
    goals90d: [],
    executionRisks: [],
    recommendedNextFocus: '',
  }
}

export class SupabaseAvatarProfileRepository implements AvatarProfileRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getByUserId(userId: string): Promise<AvatarProfile | null> {
    const { data, error } = await this.supabase
      .from('avatar_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      return null
    }

    return this.mapAvatarProfile(data)
  }

  async upsert(params: {
    userId: string
    status: AvatarProfileStatus
    currentPhase: number | null
    completedPhases: number[]
    phaseData: Record<string, AvatarPhaseSnapshot>
    profileSummary: AvatarProfileSummary
    sourceConversationId?: string | null
  }): Promise<AvatarProfile> {
    const { data, error } = await this.supabase
      .from('avatar_profiles')
      .upsert(
        {
          user_id: params.userId,
          status: params.status,
          current_phase: params.currentPhase,
          completed_phases: params.completedPhases as Json,
          phase_data: params.phaseData as unknown as Json,
          profile_summary: params.profileSummary as unknown as Json,
          source_conversation_id: params.sourceConversationId ?? null,
        },
        { onConflict: 'user_id' },
      )
      .select('*')
      .single()

    if (error || !data) {
      throw new Error(`Failed to upsert avatar profile: ${error?.message}`)
    }

    return this.mapAvatarProfile(data)
  }

  private mapAvatarProfile(row: {
    id: string
    user_id: string
    status: string
    current_phase: number | null
    completed_phases: Json
    phase_data: Json
    profile_summary: Json
    source_conversation_id: string | null
    created_at: string
    updated_at: string
  }): AvatarProfile {
    const completedPhases = Array.isArray(row.completed_phases)
      ? row.completed_phases.filter((value): value is number => typeof value === 'number')
      : []

    const phaseData = this.asRecord(row.phase_data)
    const mappedPhaseData: Record<string, AvatarPhaseSnapshot> = {}

    for (const [phaseKey, value] of Object.entries(phaseData)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        continue
      }

      const snapshotRecord = value as Record<string, unknown>

      mappedPhaseData[phaseKey] = {
        title: typeof snapshotRecord.title === 'string' ? snapshotRecord.title : undefined,
        summary: typeof snapshotRecord.summary === 'string' ? snapshotRecord.summary : '',
        extractedSignals: Array.isArray(snapshotRecord.extractedSignals)
          ? snapshotRecord.extractedSignals.filter((item): item is string => typeof item === 'string')
          : [],
        rawAnswers: Array.isArray(snapshotRecord.rawAnswers)
          ? snapshotRecord.rawAnswers.filter((item): item is string => typeof item === 'string')
          : [],
        updatedAt:
          typeof snapshotRecord.updatedAt === 'string'
            ? snapshotRecord.updatedAt
            : new Date(row.updated_at).toISOString(),
      }
    }

    return {
      id: row.id,
      userId: row.user_id,
      status: row.status as AvatarProfileStatus,
      currentPhase: row.current_phase,
      completedPhases,
      phaseData: mappedPhaseData,
      profileSummary: this.mapProfileSummary(row.profile_summary),
      sourceConversationId: row.source_conversation_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }
  }

  private mapProfileSummary(value: Json): AvatarProfileSummary {
    const record = this.asRecord(value)
    const identity = this.asRecord(record.identity as Json | undefined)

    return {
      identity: {
        selfImage: typeof identity.selfImage === 'string' ? identity.selfImage : '',
        idealSelf: typeof identity.idealSelf === 'string' ? identity.idealSelf : '',
        mainConflict: typeof identity.mainConflict === 'string' ? identity.mainConflict : '',
      },
      socialRomanticPatterns: this.asStringArray(record.socialRomanticPatterns),
      strengths: this.asStringArray(record.strengths),
      blockers: this.asStringArray(record.blockers),
      values: this.asStringArray(record.values),
      goals90d: this.asStringArray(record.goals90d),
      executionRisks: this.asStringArray(record.executionRisks),
      recommendedNextFocus:
        typeof record.recommendedNextFocus === 'string' ? record.recommendedNextFocus : '',
    }
  }

  private asRecord(value: Json | undefined): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {}
    }

    return value as Record<string, unknown>
  }

  private asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return []
    }

    return value.filter((item): item is string => typeof item === 'string')
  }
}
