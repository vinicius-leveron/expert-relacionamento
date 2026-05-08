import { Hono } from 'hono'

type ReadinessStatus = 'ok' | 'error'

export interface HealthRouteConfig {
  checks: {
    database: boolean
    email: boolean
    payment: boolean
    storage: boolean
    ai: boolean
    imageGeneration: boolean
    publicUrls: boolean
  }
}

function toStatus(value: boolean): ReadinessStatus {
  return value ? 'ok' : 'error'
}

export function createHealthRoute(config: HealthRouteConfig) {
  const app = new Hono()

  app.get('/', (c) => {
    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    })
  })

  app.get('/ready', (c) => {
    const checks = {
      database: toStatus(config.checks.database),
      email: toStatus(config.checks.email),
      payment: toStatus(config.checks.payment),
      storage: toStatus(config.checks.storage),
      ai: toStatus(config.checks.ai),
      imageGeneration: toStatus(config.checks.imageGeneration),
      publicUrls: toStatus(config.checks.publicUrls),
    }

    const isReady = Object.values(checks).every((status) => status === 'ok')

    return c.json(
      {
        status: isReady ? 'ready' : 'degraded',
        checks,
      },
      isReady ? 200 : 503,
    )
  })

  return app
}
