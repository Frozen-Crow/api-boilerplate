/**
 * Mail Utility
 * 
 * Provides email sending functionality using nodemailer.
 * Configured via app configuration (config/default.json, config/local.json, etc.)
 * 
 * Usage in services:
 * 
 * ```typescript
 * import { sendMail, sendTextEmail, sendHtmlEmail } from '../utils/mail'
 * import { sendTemplatedEmail } from '../utils/email-templates'
 * 
 * // In a service hook or method:
 * export const myService = (app: Application) => {
 *   // ... service setup
 *   
 *   // Send a text email
 *   await sendTextEmail(
 *     'user@example.com',
 *     'Welcome!',
 *     'Thank you for joining API.',
 *     app
 *   )
 *   
 *   // Send an HTML email
 *   await sendHtmlEmail(
 *     'user@example.com',
 *     'Welcome!',
 *     '<h1>Thank you for joining API.</h1>',
 *     app
 *   )
 *   
 *   // Send using a template (recommended)
 *   await sendTemplatedEmail(
 *     'user@example.com',
 *     'welcome',
 *     { name: 'John', email: 'user@example.com' },
 *     app
 *   )
 *   
 *   // Send with attachments
 *   await sendMail({
 *     to: 'user@example.com',
 *     subject: 'Report',
 *     text: 'Please find attached report.',
 *     html: '<p>Please find attached report.</p>',
 *     attachments: [{
 *       filename: 'report.pdf',
 *       path: '/path/to/report.pdf'
 *     }]
 *   }, app)
 * }
 * ```
 * 
 * Configuration (config/local.json for smtp4dev):
 * ```json
 * {
 *   "mail": {
 *     "host": "localhost",
 *     "port": 2525,
 *     "secure": false,
 *     "from": "noreply@example.com",
 *     "fromName": "My App"
 *   }
 * }
 * ```
 */

import nodemailer, { Transporter, SendMailOptions } from 'nodemailer'
import { logger } from '../logger'

// Initialize nodemailer transporter instance
let transporterInstance: Transporter | null = null

export interface MailConfig {
  host: string
  port: number
  secure?: boolean
  auth?: {
    user: string
    pass: string
  }
  from?: string
  fromName?: string
}

export interface SendMailParams {
  to: string | string[]
  subject: string
  text?: string
  html?: string
  cc?: string | string[]
  bcc?: string | string[]
  replyTo?: string
  attachments?: Array<{
    filename: string
    path?: string
    content?: string | Buffer
    contentType?: string
  }>
}

/**
 * Initialize the mail transporter with configuration from the app
 */
export const initializeMail = (app: any) => {
  const config = app.get('mail')
  if (!config) {
    logger.warn('Mail configuration not found. Email functionality will be disabled.')
    return
  }

  const mailConfig: MailConfig = {
    host: config.host || 'localhost',
    port: config.port || 587,
    secure: config.secure || false,
    auth: config.auth?.user && config.auth?.pass
      ? {
        user: config.auth.user,
        pass: config.auth.pass
      }
      : undefined,
    from: config.from || `noreply@${app.get('host').replace('localhost', 'example.com')}`,
    fromName: config.fromName || app.get('appName') || 'API'
  }

  transporterInstance = nodemailer.createTransport({
    host: mailConfig.host,
    port: mailConfig.port,
    secure: mailConfig.secure,
    auth: mailConfig.auth,
    // For local development with smtp4dev, we typically don't need auth
    tls: {
      rejectUnauthorized: false // Allow self-signed certificates for local dev
    }
  })

  logger.info('Mail transporter initialized', {
    host: mailConfig.host,
    port: mailConfig.port,
    secure: mailConfig.secure,
    hasAuth: !!mailConfig.auth
  })
}

/**
 * Get the mail transporter instance
 */
const getTransporter = (app?: any): Transporter => {
  if (!transporterInstance) {
    if (app) {
      initializeMail(app)
    } else {
      throw new Error('Mail transporter not initialized. Call initializeMail(app) first or provide app parameter.')
    }
  }

  if (!transporterInstance) {
    throw new Error('Mail transporter could not be initialized. Check your mail configuration.')
  }

  return transporterInstance
}

/**
 * Verify the mail transporter connection
 */
export const verifyMailConnection = async (app?: any): Promise<boolean> => {
  try {
    const transporter = getTransporter(app)
    await transporter.verify()
    logger.info('Mail transporter connection verified successfully')
    return true
  } catch (error) {
    logger.error('Mail transporter connection verification failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return false
  }
}

/**
 * Send an email
 */
export const sendMail = async (params: SendMailParams, app?: any): Promise<void> => {
  try {
    const transporter = getTransporter(app)
    const config = app?.get('mail') || {}

    const fromAddress = config.from || `noreply@${app?.get('host')?.replace('localhost', 'example.com') || 'example.com'}`
    const fromName = config.fromName || app?.get('appName') || 'API'
    const from = fromName ? `${fromName} <${fromAddress}>` : fromAddress

    const mailOptions: SendMailOptions = {
      from,
      to: Array.isArray(params.to) ? params.to.join(', ') : params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
      cc: params.cc ? (Array.isArray(params.cc) ? params.cc.join(', ') : params.cc) : undefined,
      bcc: params.bcc ? (Array.isArray(params.bcc) ? params.bcc.join(', ') : params.bcc) : undefined,
      replyTo: params.replyTo,
      attachments: params.attachments
    }

    logger.info('Sending email', {
      to: params.to,
      subject: params.subject,
      hasText: !!params.text,
      hasHtml: !!params.html
    })

    const info = await transporter.sendMail(mailOptions)

    logger.info('Email sent successfully', {
      messageId: info.messageId,
      to: params.to,
      subject: params.subject
    })
  } catch (error) {
    logger.error('Failed to send email', {
      error: error instanceof Error ? error.message : 'Unknown error',
      to: params.to,
      subject: params.subject
    })
    throw error
  }
}

/**
 * Send a plain text email
 */
export const sendTextEmail = async (
  to: string | string[],
  subject: string,
  text: string,
  app?: any
): Promise<void> => {
  await sendMail({ to, subject, text }, app)
}

/**
 * Send an HTML email
 */
export const sendHtmlEmail = async (
  to: string | string[],
  subject: string,
  html: string,
  app?: any
): Promise<void> => {
  await sendMail({ to, subject, html }, app)
}

/**
 * Send an email with both text and HTML versions
 */
export const sendMultipartEmail = async (
  to: string | string[],
  subject: string,
  text: string,
  html: string,
  app?: any
): Promise<void> => {
  await sendMail({ to, subject, text, html }, app)
}

