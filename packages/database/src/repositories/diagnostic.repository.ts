import type { SupabaseClient } from '../client.js'
import type { DiagnosticRow, JourneyProgressRow } from '../types.js'

export type Archetype = 'provedor' | 'aventureiro' | 'romantico' | 'racional'

export interface Diagnostic {
  id: string
  userId: string
  archetype: Archetype
  scores: Record<Archetype, number>
  answers: Array<{ questionIndex: number; answer: string }>
  completedAt: Date
}

export interface JourneyProgress {
  id: string
  userId: string
  currentDay: number
  startedAt: Date
  lastInteractionAt: Date
  status: 'active' | 'paused' | 'completed' | 'churned'
}

export interface DiagnosticRepository {
  /**
   * Busca diagnóstico do usuário
   */
  getByUserId(userId: string): Promise<Diagnostic | null>

  /**
   * Salva resultado do diagnóstico
   */
  save(params: {
    userId: string
    archetype: Archetype
    scores: Record<Archetype, number>
    answers: Array<{ questionIndex: number; answer: string }>
  }): Promise<Diagnostic>

  /**
   * Busca progresso na jornada
   */
  getJourneyProgress(userId: string): Promise<JourneyProgress | null>

  /**
   * Inicia jornada de 30 dias
   */
  startJourney(userId: string): Promise<JourneyProgress>

  /**
   * Atualiza progresso (incrementa dia, atualiza última interação)
   */
  updateJourneyProgress(
    userId: string,
    updates: Partial<Pick<JourneyProgress, 'currentDay' | 'status'>>,
  ): Promise<void>

  /**
   * Registra interação (atualiza lastInteractionAt)
   */
  recordInteraction(userId: string): Promise<void>
}

/**
 * SupabaseDiagnosticRepository - Implementação usando Supabase
 */
export class SupabaseDiagnosticRepository implements DiagnosticRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getByUserId(userId: string): Promise<Diagnostic | null> {
    const { data, error } = await this.supabase
      .from('diagnostics')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      return null
    }

    return this.mapDiagnostic(data)
  }

  async save(params: {
    userId: string
    archetype: Archetype
    scores: Record<Archetype, number>
    answers: Array<{ questionIndex: number; answer: string }>
  }): Promise<Diagnostic> {
    // Upsert - atualiza se já existe
    const { data, error } = await this.supabase
      .from('diagnostics')
      .upsert(
        {
          user_id: params.userId,
          archetype: params.archetype,
          scores: params.scores,
          answers: params.answers,
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select()
      .single()

    if (error || !data) {
      throw new Error(`Failed to save diagnostic: ${error?.message}`)
    }

    return this.mapDiagnostic(data)
  }

  async getJourneyProgress(userId: string): Promise<JourneyProgress | null> {
    const { data, error } = await this.supabase
      .from('journey_progress')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      return null
    }

    return this.mapJourneyProgress(data)
  }

  async startJourney(userId: string): Promise<JourneyProgress> {
    const now = new Date().toISOString()

    const { data, error } = await this.supabase
      .from('journey_progress')
      .upsert(
        {
          user_id: userId,
          current_day: 1,
          started_at: now,
          last_interaction_at: now,
          status: 'active',
        },
        { onConflict: 'user_id' },
      )
      .select()
      .single()

    if (error || !data) {
      throw new Error(`Failed to start journey: ${error?.message}`)
    }

    return this.mapJourneyProgress(data)
  }

  async updateJourneyProgress(
    userId: string,
    updates: Partial<Pick<JourneyProgress, 'currentDay' | 'status'>>,
  ): Promise<void> {
    const updateData: {
      last_interaction_at: string
      current_day?: number
      status?: string
    } = {
      last_interaction_at: new Date().toISOString(),
    }

    if (updates.currentDay !== undefined) {
      updateData.current_day = updates.currentDay
    }
    if (updates.status !== undefined) {
      updateData.status = updates.status
    }

    const { error } = await this.supabase
      .from('journey_progress')
      .update(updateData)
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to update journey progress: ${error.message}`)
    }
  }

  async recordInteraction(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('journey_progress')
      .update({ last_interaction_at: new Date().toISOString() })
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to record interaction: ${error.message}`)
    }
  }

  private mapDiagnostic(row: DiagnosticRow): Diagnostic {
    return {
      id: row.id,
      userId: row.user_id,
      archetype: row.archetype as Archetype,
      scores: row.scores as Record<Archetype, number>,
      answers: row.answers as Array<{ questionIndex: number; answer: string }>,
      completedAt: new Date(row.completed_at),
    }
  }

  private mapJourneyProgress(row: JourneyProgressRow): JourneyProgress {
    return {
      id: row.id,
      userId: row.user_id,
      currentDay: row.current_day,
      startedAt: new Date(row.started_at),
      lastInteractionAt: new Date(row.last_interaction_at),
      status: row.status as JourneyProgress['status'],
    }
  }
}
