import type { EmailSender } from '@perpetuo/core'
import type { Logger } from 'pino'

/**
 * Mock email sender for development
 * In production, replace with real email service (SendGrid, AWS SES, etc.)
 */
export class MockEmailSender implements EmailSender {
  // Store last link for dev debugging
  public lastLink: string | null = null
  public lastEmail: string | null = null

  constructor(private readonly logger: Logger) {}

  async sendMagicLink(email: string, link: string): Promise<void> {
    // Store for dev access
    this.lastLink = link
    this.lastEmail = email

    // In development, log the link prominently
    this.logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    this.logger.info(`📧 MAGIC LINK for ${email}:`)
    this.logger.info(`🔗 ${link}`)
    this.logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // In a real implementation, this would send an actual email
    // Example with SendGrid:
    // await sgMail.send({
    //   to: email,
    //   from: 'noreply@perpetuo.app',
    //   subject: 'Acesse o Perpétuo',
    //   html: `<p>Clique no link para acessar: <a href="${link}">${link}</a></p>`,
    // })
  }
}

/**
 * Production email sender using Resend
 * Requires RESEND_API_KEY environment variable
 */
export class ResendEmailSender implements EmailSender {
  private readonly apiKey: string
  private readonly fromEmail: string

  constructor(config: { apiKey: string; fromEmail?: string }) {
    this.apiKey = config.apiKey
    this.fromEmail = config.fromEmail ?? 'noreply@perpetuo.app'
  }

  async sendMagicLink(email: string, link: string): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.fromEmail,
        to: email,
        subject: 'Acesse o Perpétuo',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Olá!</h1>
            <p>Clique no botão abaixo para acessar o Perpétuo:</p>
            <a href="${link}" style="display: inline-block; background-color: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
              Acessar Perpétuo
            </a>
            <p style="color: #666; font-size: 14px;">
              Este link expira em 15 minutos.<br>
              Se você não solicitou este acesso, ignore este email.
            </p>
          </div>
        `,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to send email: ${error}`)
    }
  }
}

/**
 * Creates the appropriate email sender based on environment
 */
export function createEmailSender(logger: Logger): EmailSender {
  const resendApiKey = process.env.RESEND_API_KEY

  if (resendApiKey) {
    logger.info('Using Resend email sender')
    return new ResendEmailSender({
      apiKey: resendApiKey,
      fromEmail: process.env.RESEND_FROM_EMAIL,
    })
  }

  logger.warn('RESEND_API_KEY not set, using mock email sender')
  return new MockEmailSender(logger)
}
