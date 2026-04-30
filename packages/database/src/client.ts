import { type SupabaseClient as BaseSupabaseClient, createClient } from '@supabase/supabase-js'
import type { Database } from './types.js'

export type SupabaseClient = BaseSupabaseClient<Database>

export function createSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'SUPABASE_URL and one of SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY are required',
    )
  }

  return createClient<Database>(supabaseUrl, supabaseKey)
}

// Lazy singleton para uso em runtime (não em build)
let _supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createSupabaseClient()
  }
  return _supabase
}
