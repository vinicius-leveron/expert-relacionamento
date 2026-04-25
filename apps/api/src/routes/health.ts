import { Hono } from 'hono'

export const healthRoute = new Hono()

healthRoute.get('/', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
})

healthRoute.get('/ready', async (c) => {
  // TODO: Verificar conexão com Supabase
  return c.json({
    status: 'ready',
    checks: {
      database: 'ok',
    },
  })
})
