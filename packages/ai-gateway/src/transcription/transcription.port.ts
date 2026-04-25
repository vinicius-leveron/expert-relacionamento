/**
 * TranscriptionPort - Interface para transcrição de áudio
 */
export interface TranscriptionResult {
  text: string
  language?: string
  duration?: number
}

export interface TranscriptionPort {
  readonly providerName: string

  /**
   * Transcreve áudio a partir de URL
   */
  transcribe(audioUrl: string): Promise<TranscriptionResult>

  /**
   * Transcreve áudio a partir de buffer
   */
  transcribeBuffer(buffer: Buffer, format: 'mp3' | 'wav' | 'ogg'): Promise<TranscriptionResult>
}
