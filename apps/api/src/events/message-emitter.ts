import { EventEmitter } from 'node:events'
import type { MessageEmitter as IMessageEmitter, EmittedMessage } from '@perpetuo/app-adapter'

/**
 * MessageEmitter - Gerencia eventos de mensagens para SSE
 *
 * Permite que o AppChannelAdapter emita mensagens que serão
 * enviadas para os clientes conectados via Server-Sent Events.
 */
export class MessageEmitter implements IMessageEmitter {
  private readonly emitter = new EventEmitter()

  constructor() {
    // Aumenta o limite de listeners para suportar múltiplas conexões
    this.emitter.setMaxListeners(1000)
  }

  /**
   * Emite uma mensagem para um usuário específico
   */
  emit(userId: string, message: EmittedMessage): void {
    this.emitter.emit(`message:${userId}`, message)
  }

  /**
   * Subscreve para receber mensagens de um usuário
   */
  subscribe(userId: string, callback: (message: EmittedMessage) => void): () => void {
    const eventName = `message:${userId}`
    this.emitter.on(eventName, callback)

    // Retorna função para cancelar a subscription
    return () => {
      this.emitter.off(eventName, callback)
    }
  }

  /**
   * Verifica se há listeners para um usuário
   */
  hasListeners(userId: string): boolean {
    return this.emitter.listenerCount(`message:${userId}`) > 0
  }

  /**
   * Retorna o número de listeners para um usuário
   */
  getListenerCount(userId: string): number {
    return this.emitter.listenerCount(`message:${userId}`)
  }
}
