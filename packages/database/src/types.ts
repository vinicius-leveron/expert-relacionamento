/**
 * Database types - Gerado pelo Supabase CLI
 *
 * Para regenerar após mudanças no schema:
 * supabase gen types typescript --local > packages/database/src/types.ts
 *
 * Por enquanto, types manuais até setup do Supabase local
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          phone_e164: string | null
          email: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          phone_e164?: string | null
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          phone_e164?: string | null
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      knowledge_documents: {
        Row: {
          id: string
          title: string
          source_type: string
          source_url: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          source_type: string
          source_url?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          source_type?: string
          source_url?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      knowledge_chunks: {
        Row: {
          id: string
          document_id: string
          content: string
          embedding: number[] | null
          chunk_index: number
          token_count: number | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          content: string
          embedding?: number[] | null
          chunk_index: number
          token_count?: number | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          content?: string
          embedding?: number[] | null
          chunk_index?: number
          token_count?: number | null
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'knowledge_chunks_document_id_fkey'
            columns: ['document_id']
            referencedRelation: 'knowledge_documents'
            referencedColumns: ['id']
          },
        ]
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          channel: string
          status: string
          summary: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          channel?: string
          status?: string
          summary?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          channel?: string
          status?: string
          summary?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'conversations_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          role: string
          content: string
          content_type: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: string
          content: string
          content_type?: string
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          role?: string
          content?: string
          content_type?: string
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey'
            columns: ['conversation_id']
            referencedRelation: 'conversations'
            referencedColumns: ['id']
          },
        ]
      }
      diagnostics: {
        Row: {
          id: string
          user_id: string
          archetype: string
          scores: Json
          answers: Json
          completed_at: string
        }
        Insert: {
          id?: string
          user_id: string
          archetype: string
          scores?: Json
          answers?: Json
          completed_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          archetype?: string
          scores?: Json
          answers?: Json
          completed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'diagnostics_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      journey_progress: {
        Row: {
          id: string
          user_id: string
          current_day: number
          started_at: string
          last_interaction_at: string
          status: string
        }
        Insert: {
          id?: string
          user_id: string
          current_day?: number
          started_at?: string
          last_interaction_at?: string
          status?: string
        }
        Update: {
          id?: string
          user_id?: string
          current_day?: number
          started_at?: string
          last_interaction_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'journey_progress_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          external_id: string
          gateway: string
          plan_id: string
          status: string
          start_date: string
          end_date: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          external_id: string
          gateway: string
          plan_id: string
          status: string
          start_date: string
          end_date?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          external_id?: string
          gateway?: string
          plan_id?: string
          status?: string
          start_date?: string
          end_date?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'subscriptions_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      search_knowledge: {
        Args: {
          query_embedding: number[]
          match_threshold: number
          match_count: number
        }
        Returns: {
          id: string
          document_id: string
          content: string
          similarity: number
          metadata: Json
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database['public']['Tables'] & Database['public']['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database['public']['Tables'] &
        Database['public']['Views'])
    ? (Database['public']['Tables'] &
        Database['public']['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

// Convenience types
export type UserRow = Database['public']['Tables']['users']['Row']
export type ConversationRow = Database['public']['Tables']['conversations']['Row']
export type MessageRow = Database['public']['Tables']['messages']['Row']
export type DiagnosticRow = Database['public']['Tables']['diagnostics']['Row']
export type JourneyProgressRow = Database['public']['Tables']['journey_progress']['Row']
export type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row']
export type KnowledgeDocumentRow = Database['public']['Tables']['knowledge_documents']['Row']
export type KnowledgeChunkRow = Database['public']['Tables']['knowledge_chunks']['Row']
