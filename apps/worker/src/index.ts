import pino from 'pino'

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
})

/**
 * Worker - Processamento assíncrono de jobs
 *
 * Épico 1+:
 * - Nurturing (sequência 30 dias por arquétipo)
 * - Reengajamento (gatilhos por inatividade)
 * - Sumarização de contexto
 *
 * Por enquanto, apenas stub.
 */
async function main() {
  logger.info('Worker starting...')
  logger.info('Worker is a stub - no jobs configured yet')

  // Mantém processo ativo para dev
  if (process.env.NODE_ENV !== 'production') {
    setInterval(() => {
      logger.debug('Worker heartbeat')
    }, 60000)
  }
}

main().catch((err) => {
  logger.error(err, 'Worker failed to start')
  process.exit(1)
})
