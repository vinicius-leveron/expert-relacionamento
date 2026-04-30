// Vercel Serverless Handler - Full API
const crypto = require('crypto')

// Simple JWT implementation using Node.js crypto
const createToken = (payload, secret, expiresIn = '7d') => {
  const header = { alg: 'HS256', typ: 'JWT' }

  // Parse expiresIn to seconds
  let expSeconds = 7 * 24 * 60 * 60 // default 7 days
  if (typeof expiresIn === 'string') {
    const match = expiresIn.match(/^(\d+)([smhd])$/)
    if (match) {
      const num = parseInt(match[1])
      const unit = match[2]
      expSeconds = unit === 's' ? num : unit === 'm' ? num * 60 : unit === 'h' ? num * 3600 : num * 86400
    }
  }

  const now = Math.floor(Date.now() / 1000)
  const fullPayload = { ...payload, iat: now, exp: now + expSeconds }

  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url')
  const base64Payload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url')
  const signature = crypto.createHmac('sha256', secret).update(`${base64Header}.${base64Payload}`).digest('base64url')

  return `${base64Header}.${base64Payload}.${signature}`
}

const verifyToken = (token, secret) => {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid token')

  const [header, payload, signature] = parts
  const expectedSig = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')

  if (signature !== expectedSig) throw new Error('Invalid signature')

  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString())
  if (decoded.exp && decoded.exp < Date.now() / 1000) throw new Error('Token expired')

  return decoded
}

// CORS headers
const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Content-Type', 'application/json')
}

// Parse JSON body
const parseBody = async (req) => {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      try {
        resolve(JSON.parse(body))
      } catch {
        resolve({})
      }
    })
  })
}

// JWT decode (simple)
const decodeToken = (authHeader) => {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    if (payload.exp && payload.exp < Date.now() / 1000) return null
    return payload
  } catch {
    return null
  }
}

module.exports = async (req, res) => {
  cors(res)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const url = new URL(req.url, `http://${req.headers.host}`)
  const path = url.pathname
  const secret = process.env.JWT_SECRET || 'dev-secret-key-change-in-production'

  // Root
  if (path === '/' || path === '') {
    return res.status(200).json({
      name: 'Perpetuo API',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        health: '/health',
        auth: '/auth/magic-link',
        chat: '/api/v1/chat'
      }
    })
  }

  // Health
  if (path === '/health' || path === '/health/live' || path === '/health/ready') {
    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString()
    })
  }

  // Auth check for protected routes
  const token = decodeToken(req.headers.authorization)

  // Magic link auth (mobile app routes)
  if (path === '/auth/magic-link' && req.method === 'POST') {
    const body = await parseBody(req)
    if (!body.email) {
      return res.status(400).json({ success: false, error: 'Email required' })
    }

    const magicToken = createToken({ email: body.email, type: 'magic-link' }, secret, '15m')

    // Return in format expected by mobile app
    return res.status(200).json({
      success: true,
      data: {
        message: 'Magic link sent',
        // In dev/preview, include the token directly for easy testing
        devLink: `perpetuo://verify?token=${magicToken}`
      }
    })
  }

  if (path === '/auth/verify' && req.method === 'POST') {
    const body = await parseBody(req)
    if (!body.token) {
      return res.status(400).json({ success: false, error: 'Token required' })
    }

    try {
      const decoded = verifyToken(body.token, secret)
      const accessToken = createToken({ email: decoded.email, sub: decoded.email }, secret, '7d')
      const refreshToken = createToken({ email: decoded.email, type: 'refresh' }, secret, '30d')

      return res.status(200).json({
        success: true,
        data: {
          accessToken,
          refreshToken,
          user: { email: decoded.email, name: null }
        }
      })
    } catch (e) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' })
    }
  }

  if (path === '/auth/refresh' && req.method === 'POST') {
    const body = await parseBody(req)
    if (!body.refreshToken) {
      return res.status(400).json({ success: false, error: 'Refresh token required' })
    }

    try {
      const decoded = verifyToken(body.refreshToken, secret)
      const accessToken = createToken({ email: decoded.email, sub: decoded.email }, secret, '7d')
      const newRefreshToken = createToken({ email: decoded.email, type: 'refresh' }, secret, '30d')
      return res.status(200).json({
        success: true,
        data: { accessToken, refreshToken: newRefreshToken }
      })
    } catch (e) {
      return res.status(401).json({ success: false, error: 'Invalid refresh token' })
    }
  }

  if (path === '/auth/logout' && req.method === 'POST') {
    return res.status(200).json({ success: true })
  }

  // Public routes (legacy phone auth)
  if (path === '/api/v1/auth/request-code' && req.method === 'POST') {
    const body = await parseBody(req)
    if (!body.phone) {
      return res.status(400).json({ error: 'Phone required' })
    }
    return res.status(200).json({ success: true, message: 'Code sent' })
  }

  if (path === '/api/v1/auth/verify-code' && req.method === 'POST') {
    const body = await parseBody(req)
    if (!body.phone || !body.code) {
      return res.status(400).json({ error: 'Phone and code required' })
    }
    const accessToken = createToken({ phone: body.phone, sub: body.phone }, secret, '7d')
    return res.status(200).json({ accessToken, user: { phone: body.phone } })
  }

  // Protected routes - require auth
  const protectedPaths = ['/conversations', '/api/v1/']
  const needsAuth = protectedPaths.some(p => path.startsWith(p))
  if (!token && needsAuth) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  // Create conversation
  if (path === '/conversations' && req.method === 'POST') {
    const conversationId = crypto.randomUUID()
    return res.status(200).json({
      success: true,
      data: {
        id: conversationId,
        title: 'Nova conversa',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    })
  }

  // List conversations
  if (path === '/conversations' && req.method === 'GET') {
    return res.status(200).json({
      success: true,
      data: []
    })
  }

  // Get messages from conversation
  const messageMatch = path.match(/^\/conversations\/([^/]+)\/messages$/)
  if (messageMatch && req.method === 'GET') {
    return res.status(200).json({
      success: true,
      data: []
    })
  }

  // Send message to conversation
  if (messageMatch && req.method === 'POST') {
    const conversationId = messageMatch[1]
    const body = await parseBody(req)

    // For now, return a simple response
    const userMessage = body.content || ''
    const assistantMessage = {
      id: crypto.randomUUID(),
      conversationId,
      role: 'assistant',
      content: `Olá! Recebi sua mensagem: "${userMessage.substring(0, 50)}...". A IA está sendo configurada.`,
      createdAt: new Date().toISOString()
    }

    return res.status(200).json({
      success: true,
      data: {
        userMessage: {
          id: crypto.randomUUID(),
          conversationId,
          role: 'user',
          content: userMessage,
          createdAt: new Date().toISOString()
        },
        assistantMessage
      }
    })
  }

  // User profile
  if (path === '/api/v1/users/me' && req.method === 'GET') {
    return res.status(200).json({ phone: token?.phone, email: token?.email, name: null })
  }

  // Legacy conversations endpoint
  if (path === '/api/v1/conversations' && req.method === 'GET') {
    return res.status(200).json([])
  }

  // Legacy chat endpoint
  if (path === '/api/v1/chat' && req.method === 'POST') {
    return res.status(200).json({
      id: Date.now().toString(),
      role: 'assistant',
      content: 'API configurada! Configure ANTHROPIC_API_KEY para respostas reais.',
      timestamp: new Date().toISOString()
    })
  }

  // Not found
  return res.status(404).json({ success: false, error: 'Not found', path })
}
