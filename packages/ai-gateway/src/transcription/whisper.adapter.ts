import type { TranscriptionPort, TranscriptionResult } from './transcription.port.js'

export interface WhisperConfig {
  apiKey?: string
  model?: string
}

const DEFAULT_MODEL = 'whisper-1'

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

    // Detecta formato pelo URL ou content-type
    const contentType = response.headers.get('content-type') ?? ''
    let format: 'mp3' | 'wav' | 'ogg' = 'ogg'
    if (contentType.includes('mp3') || audioUrl.includes('.mp3')) {
      format = 'mp3'
    } else if (contentType.includes('wav') || audioUrl.includes('.wav')) {
      format = 'wav'
    }

    return this.transcribeBuffer(buffer, format)
  }

  async transcribeBuffer(
    buffer: Buffer,
    format: 'mp3' | 'wav' | 'ogg',
  ): Promise<TranscriptionResult> {
    const formData = new FormData()

    // Cria um blob a partir do buffer
    const blob = new Blob([buffer], { type: `audio/${format}` })
    formData.append('file', blob, `audio.${format}`)
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
}

interface WhisperResponse {
  text: string
}
