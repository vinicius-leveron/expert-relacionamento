import type { TranscriptionPort, TranscriptionResult } from './transcription.port.js'

/**
 * MockTranscriptionAdapter - Para testes sem API key
 */
export class MockTranscriptionAdapter implements TranscriptionPort {
  readonly providerName = 'mock'

  private mockTranscriptions: Map<string, string> = new Map()

  async transcribe(audioUrl: string): Promise<TranscriptionResult> {
    // Retorna transcrição mockada se existir
    const mockText = this.mockTranscriptions.get(audioUrl)
    if (mockText) {
      return { text: mockText, language: 'pt' }
    }

    // Caso contrário, retorna texto padrão
    return {
      text: 'Transcrição de teste: Olá, estou testando o áudio.',
      language: 'pt',
      duration: 5,
    }
  }

  async transcribeBuffer(
    _buffer: Buffer,
    _format: 'mp3' | 'wav' | 'ogg',
  ): Promise<TranscriptionResult> {
    return {
      text: 'Transcrição de teste do buffer de áudio.',
      language: 'pt',
    }
  }

  /**
   * Helper para testes - adiciona transcrição mockada
   */
  addMockTranscription(audioUrl: string, text: string): void {
    this.mockTranscriptions.set(audioUrl, text)
  }
}
