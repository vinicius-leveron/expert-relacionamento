/**
 * Port for image generation services
 */

export interface ImageGenerationOptions {
  size?: '256x256' | '512x512' | '1024x1024'
  style?: 'vivid' | 'natural'
  quality?: 'standard' | 'hd'
}

export interface GeneratedImage {
  url?: string
  base64?: string
  mimeType?: string
  revisedPrompt?: string
}

export interface ImageGenerationPort {
  /**
   * Provider name for logging
   */
  readonly providerName: string

  /**
   * Generate an image from a text prompt
   */
  generate(prompt: string, options?: ImageGenerationOptions): Promise<GeneratedImage>

  /**
   * Edit an existing image with a prompt (optional, not all providers support this)
   */
  edit?(image: Buffer, prompt: string, options?: ImageGenerationOptions): Promise<GeneratedImage>
}
