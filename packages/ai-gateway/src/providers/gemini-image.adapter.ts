import { GoogleGenAI, Modality, type GenerateContentConfig } from '@google/genai'
import type {
  GeneratedImage,
  ImageGenerationOptions,
  ImageGenerationPort,
} from '../ports/image-generation.port.js'

const DEFAULT_MODEL = 'gemini-3.1-flash-image-preview'

export interface GeminiImageConfig {
  apiKey: string
  model?: string
}

export class GeminiImageAdapter implements ImageGenerationPort {
  readonly providerName: string

  private readonly client: GoogleGenAI
  private readonly model: string

  constructor(config: GeminiImageConfig) {
    if (!config.apiKey) {
      throw new Error('GOOGLE_API_KEY is required for GeminiImageAdapter')
    }

    this.client = new GoogleGenAI({ apiKey: config.apiKey })
    this.model = config.model ?? DEFAULT_MODEL
    this.providerName = this.model
  }

  async generate(prompt: string, options?: ImageGenerationOptions): Promise<GeneratedImage> {
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: buildPrompt(prompt, options),
        config: buildConfig(options),
      })

      const parts = response.candidates?.[0]?.content?.parts ?? []
      for (const part of parts) {
        if (part.inlineData?.data) {
          return {
            base64: part.inlineData.data,
            mimeType: part.inlineData.mimeType ?? 'image/png',
          }
        }
      }

      const textError = parts
        .map((part) => part.text?.trim())
        .find((value) => Boolean(value))

      if (textError) {
        throw new Error(textError)
      }

      throw new Error('No image data returned by Gemini')
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Gemini image generation failed: ${error.message}`)
      }

      throw new Error('Gemini image generation failed: Unknown error')
    }
  }
}

export class VertexAIImageAdapter implements ImageGenerationPort {
  readonly providerName = 'vertex-imagen'

  constructor(
    private readonly config: {
      projectId: string
      location?: string
      model?: string
    },
  ) {}

  async generate(_prompt: string, _options?: ImageGenerationOptions): Promise<GeneratedImage> {
    throw new Error(
      `Vertex AI image adapter is not implemented for project ${this.config.projectId}.`,
    )
  }
}

function buildPrompt(prompt: string, options?: ImageGenerationOptions): string {
  const parts = [prompt.trim()]

  if (options?.style === 'vivid') {
    parts.push('Use vibrant colors, confident contrast, and crisp lighting.')
  }

  if (options?.style === 'natural') {
    parts.push('Use natural lighting, realistic tones, and restrained contrast.')
  }

  if (options?.quality === 'hd') {
    parts.push('Prioritize polished details and premium rendering quality.')
  }

  parts.push('Return the final answer as an image only.')

  return parts.join(' ')
}

function buildConfig(options?: ImageGenerationOptions): GenerateContentConfig {
  return {
    responseModalities: [Modality.IMAGE],
    imageConfig: {
      aspectRatio: '1:1',
      imageSize: mapImageSize(options),
    },
  }
}

function mapImageSize(options?: ImageGenerationOptions): '512' | '1K' | '2K' {
  if (options?.quality === 'hd') {
    return '2K'
  }

  if (options?.size === '256x256' || options?.size === '512x512') {
    return '512'
  }

  return '1K'
}
