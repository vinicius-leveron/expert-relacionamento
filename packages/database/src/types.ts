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
          display_name: string | null
          avatar_storage_path: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          phone_e164?: string | null
          email?: string | null
          display_name?: string | null
          avatar_storage_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          phone_e164?: string | null
          email?: string | null
          display_name?: string | null
          avatar_storage_path?: string | null
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
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          channel?: string
          status?: string
          summary?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          channel?: string
          status?: string
          summary?: string | null
          metadata?: Json
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
      avatar_profiles: {
        Row: {
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
        }
        Insert: {
          id?: string
          user_id: string
          status?: string
          current_phase?: number | null
          completed_phases?: Json
          phase_data?: Json
          profile_summary?: Json
          source_conversation_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          status?: string
          current_phase?: number | null
          completed_phases?: Json
          phase_data?: Json
          profile_summary?: Json
          source_conversation_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'avatar_profiles_source_conversation_id_fkey'
            columns: ['source_conversation_id']
            referencedRelation: 'conversations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'avatar_profiles_user_id_fkey'
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
      chat_attachments: {
        Row: {
          id: string
          user_id: string
          conversation_id: string
          scope: string
          file_name: string
          mime_type: string
          size_bytes: number
          storage_path: string
          sha256: string | null
          status: string
          error_message: string | null
          page_count: number | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          conversation_id: string
          scope?: string
          file_name: string
          mime_type: string
          size_bytes: number
          storage_path: string
          sha256?: string | null
          status?: string
          error_message?: string | null
          page_count?: number | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          conversation_id?: string
          scope?: string
          file_name?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          sha256?: string | null
          status?: string
          error_message?: string | null
          page_count?: number | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'chat_attachments_conversation_id_fkey'
            columns: ['conversation_id']
            referencedRelation: 'conversations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'chat_attachments_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      message_attachments: {
        Row: {
          id: string
          message_id: string
          attachment_id: string
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          attachment_id: string
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          attachment_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'message_attachments_attachment_id_fkey'
            columns: ['attachment_id']
            referencedRelation: 'chat_attachments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'message_attachments_message_id_fkey'
            columns: ['message_id']
            referencedRelation: 'messages'
            referencedColumns: ['id']
          },
        ]
      }
      chat_attachment_chunks: {
        Row: {
          id: string
          attachment_id: string
          user_id: string
          conversation_id: string
          content: string
          embedding: number[] | null
          chunk_index: number
          token_count: number | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          attachment_id: string
          user_id: string
          conversation_id: string
          content: string
          embedding?: number[] | null
          chunk_index: number
          token_count?: number | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          attachment_id?: string
          user_id?: string
          conversation_id?: string
          content?: string
          embedding?: number[] | null
          chunk_index?: number
          token_count?: number | null
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'chat_attachment_chunks_attachment_id_fkey'
            columns: ['attachment_id']
            referencedRelation: 'chat_attachments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'chat_attachment_chunks_conversation_id_fkey'
            columns: ['conversation_id']
            referencedRelation: 'conversations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'chat_attachment_chunks_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      chat_attachment_jobs: {
        Row: {
          id: string
          attachment_id: string
          job_type: string
          status: string
          attempt_count: number
          scheduled_at: string
          started_at: string | null
          finished_at: string | null
          last_error: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          attachment_id: string
          job_type?: string
          status?: string
          attempt_count?: number
          scheduled_at?: string
          started_at?: string | null
          finished_at?: string | null
          last_error?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          attachment_id?: string
          job_type?: string
          status?: string
          attempt_count?: number
          scheduled_at?: string
          started_at?: string | null
          finished_at?: string | null
          last_error?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'chat_attachment_jobs_attachment_id_fkey'
            columns: ['attachment_id']
            referencedRelation: 'chat_attachments'
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
          last_nurturing_sent_at: string | null
          last_reengagement_sent_at: string | null
          status: string
        }
        Insert: {
          id?: string
          user_id: string
          current_day?: number
          started_at?: string
          last_interaction_at?: string
          last_nurturing_sent_at?: string | null
          last_reengagement_sent_at?: string | null
          status?: string
        }
        Update: {
          id?: string
          user_id?: string
          current_day?: number
          started_at?: string
          last_interaction_at?: string
          last_nurturing_sent_at?: string | null
          last_reengagement_sent_at?: string | null
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
      sessions: {
        Row: {
          id: string
          user_id: string
          refresh_token_hash: string
          device_info: Json
          expires_at: string
          created_at: string
          revoked_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          refresh_token_hash: string
          device_info?: Json
          expires_at: string
          created_at?: string
          revoked_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          refresh_token_hash?: string
          device_info?: Json
          expires_at?: string
          created_at?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'sessions_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      magic_links: {
        Row: {
          id: string
          email: string
          token_hash: string
          expires_at: string
          used_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          token_hash: string
          expires_at: string
          used_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          token_hash?: string
          expires_at?: string
          used_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      verification_codes: {
        Row: {
          id: string
          user_id: string
          code: string
          purpose: string
          expires_at: string
          used_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          code: string
          purpose?: string
          expires_at: string
          used_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          code?: string
          purpose?: string
          expires_at?: string
          used_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'verification_codes_user_id_fkey'
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
      search_chat_attachment_chunks: {
        Args: {
          query_embedding: number[]
          filter_user_id: string
          filter_conversation_id: string
          filter_attachment_ids?: string[] | null
          match_threshold: number
          match_count: number
        }
        Returns: {
          id: string
          attachment_id: string
          file_name: string
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
export type AvatarProfileRow = Database['public']['Tables']['avatar_profiles']['Row']
export type MessageRow = Database['public']['Tables']['messages']['Row']
export type ChatAttachmentRow = Database['public']['Tables']['chat_attachments']['Row']
export type MessageAttachmentRow = Database['public']['Tables']['message_attachments']['Row']
export type ChatAttachmentChunkRow = Database['public']['Tables']['chat_attachment_chunks']['Row']
export type ChatAttachmentJobRow = Database['public']['Tables']['chat_attachment_jobs']['Row']
export type DiagnosticRow = Database['public']['Tables']['diagnostics']['Row']
export type JourneyProgressRow = Database['public']['Tables']['journey_progress']['Row']
export type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row']
export type KnowledgeDocumentRow = Database['public']['Tables']['knowledge_documents']['Row']
export type KnowledgeChunkRow = Database['public']['Tables']['knowledge_chunks']['Row']
export type SessionRow = Database['public']['Tables']['sessions']['Row']
export type MagicLinkRow = Database['public']['Tables']['magic_links']['Row']
export type VerificationCodeRow = Database['public']['Tables']['verification_codes']['Row']
