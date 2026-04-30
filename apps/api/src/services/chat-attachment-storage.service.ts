import type { SupabaseClient } from '@perpetuo/database'

export interface SignedUpload {
  signedUrl: string
  token: string
  path: string
}

export interface StoredObject {
  path: string
  fullPath?: string
}

export class ChatAttachmentStorageService {
  static readonly bucketName = 'chat-attachments'

  constructor(private readonly supabase: SupabaseClient) {}

  async createSignedUpload(path: string): Promise<SignedUpload> {
    const { data, error } = await this.supabase.storage
      .from(ChatAttachmentStorageService.bucketName)
      .createSignedUploadUrl(path)

    if (error || !data) {
      throw new Error(`Failed to create signed upload url: ${error?.message}`)
    }

    return data
  }

  async removeObject(path: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(ChatAttachmentStorageService.bucketName)
      .remove([path])

    if (error) {
      throw new Error(`Failed to remove attachment object: ${error.message}`)
    }
  }

  async uploadBuffer(params: {
    path: string
    data: Buffer
    contentType: string
  }): Promise<StoredObject> {
    const { data, error } = await this.supabase.storage
      .from(ChatAttachmentStorageService.bucketName)
      .upload(params.path, params.data, {
        contentType: params.contentType,
        upsert: false,
      })

    if (error || !data) {
      throw new Error(`Failed to upload object: ${error?.message}`)
    }

    return data
  }

  async createSignedReadUrl(path: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(ChatAttachmentStorageService.bucketName)
      .createSignedUrl(path, expiresInSeconds)

    if (error || !data?.signedUrl) {
      throw new Error(`Failed to create signed read url: ${error?.message}`)
    }

    return data.signedUrl
  }
}

export function sanitizeAttachmentFileName(fileName: string): string {
  const trimmed = fileName.trim().replace(/\s+/g, '-')
  const sanitized = trimmed.replace(/[^a-zA-Z0-9._-]/g, '')

  if (!sanitized) {
    return 'attachment'
  }

  return sanitized.slice(0, 120)
}
