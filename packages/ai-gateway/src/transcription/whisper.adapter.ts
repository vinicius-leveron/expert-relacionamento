import type { TranscriptionPort, TranscriptionResult } from './transcription.port.js'

export interface WhisperConfig {
  apiKey?: string
  model?: string
}

const DEFAULT_MODEL = 'whisper-1'

type TranscriptionFileFormat = {
  fileName: string
  mimeType: string
}

/**
 * WhisperAdapter - Transcrição usando OpenAI Whisper
 */
export class WhisperAdapter implements TranscriptionPort {
  readonly providerName = 'whisper'

  private readonly apiKey: string
  private readonly model: string

  constructor(config: WhisperConfig = {}) {
    const apiKey = config.apiKey ?? process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for Whisper transcription')
    }
    this.apiKey = apiKey
    this.model = config.model ?? DEFAULT_MODEL
  }

  async transcribe(audioUrl: string): Promise<TranscriptionResult> {
    // Faz download do áudio
    const response = await fetch(audioUrl)
    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.statusText}`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    const contentType = response.headers.get('content-type') ?? ''
    return this.transcribeBuffer(buffer, this.resolveFormat(audioUrl, contentType))
  }

  async transcribeBuffer(
    buffer: Buffer,
    format: TranscriptionFileFormat,
  ): Promise<TranscriptionResult> {
    const formData = new FormData()

    // Cria um blob a partir do buffer
    const blob = new Blob([buffer], { type: format.mimeType })
    formData.append('file', blob, format.fileName)
    formData.append('model', this.model)
    formData.append('language', 'pt') // Português

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Whisper transcription failed: ${error}`)
    }

    const data = (await response.json()) as WhisperResponse

    return {
      text: data.text,
      language: 'pt',
    }
  }

  private resolveFormat(audioUrl: string, contentType: string): TranscriptionFileFormat {
    const normalizedType = contentType.split(';')[0]?.trim().toLowerCase() ?? ''
    const normalizedUrl = audioUrl.toLowerCase()

    if (
      normalizedType.includes('mpeg') ||
      normalizedType.includes('mp3') ||
      normalizedUrl.includes('.mp3') ||
      normalizedUrl.includes('.mpeg') ||
      normalizedUrl.includes('.mpga')
    ) {
      return { fileName: 'audio.mp3', mimeType: 'audio/mpeg' }
    }

    if (normalizedType.includes('wav') || normalizedUrl.includes('.wav')) {
      return { fileName: 'audio.wav', mimeType: 'audio/wav' }
    }

    if (normalizedType.includes('webm') || normalizedUrl.includes('.webm')) {
      return { fileName: 'audio.webm', mimeType: 'audio/webm' }
    }

    if (normalizedType.includes('ogg') || normalizedUrl.includes('.ogg')) {
      return { fileName: 'audio.ogg', mimeType: 'audio/ogg' }
    }

    if (normalizedType.includes('aac') || normalizedUrl.includes('.aac')) {
      return { fileName: 'audio.aac', mimeType: 'audio/aac' }
    }

    if (
      normalizedType.includes('mp4') ||
      normalizedType.includes('m4a') ||
      normalizedType.includes('x-m4a') ||
      normalizedUrl.includes('.mp4') ||
      normalizedUrl.includes('.m4a')
    ) {
      return { fileName: 'audio.m4a', mimeType: 'audio/mp4' }
    }

    return { fileName: 'audio.webm', mimeType: 'audio/webm' }
  }
}

interface WhisperResponse {
  text: string
}
