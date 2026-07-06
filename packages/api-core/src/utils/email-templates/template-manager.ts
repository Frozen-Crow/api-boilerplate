/**
 * Email Template Manager
 * 
 * Manages email templates using doT.js templating engine.
 * Templates are stored in the templates/ directory.
 * 
 * Usage:
 * ```typescript
 * import { renderTemplate, sendTemplatedEmail } from '../utils/email-templates/template-manager'
 * 
 * // Render a template
 * const html = await renderTemplate('welcome', { name: 'John', email: 'john@example.com' })
 * 
 * // Send a templated email
 * await sendTemplatedEmail(
 *   'user@example.com',
 *   'welcome',
 *   { name: 'John', email: 'john@example.com' },
 *   app
 * )
 * ```
 */

import doT from 'dot'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { logger } from '../../logger'
import { sendMail } from '../mail'
import type { Application } from '../../declarations'

// Template cache
const templateCache: Map<string, doT.RenderFunction> = new Map()

// Optional consumer override for the templates directory.
let templatesDirOverride: string | null = null

/**
 * Point the template engine at a custom directory of `.dot` templates. Set by
 * `configureCore` when `options.templatesDir` is provided, letting consumers
 * override the bundled emails. Clears the compiled-template cache.
 */
export const setTemplatesDir = (dir: string | null): void => {
  templatesDirOverride = dir
  templateCache.clear()
}

// Get templates directory path.
// Resolves relative to this compiled module first (templates ship inside the
// package next to the JS), so it works from within node_modules. A consumer
// override and cwd-based fallbacks are also honored.
const getTemplatesDir = (): string => {
  const possiblePaths = [
    ...(templatesDirOverride ? [templatesDirOverride] : []),
    join(__dirname, 'templates'), // Bundled next to compiled output (package install)
    join(process.cwd(), 'lib', 'utils', 'email-templates', 'templates'), // Built app
    join(process.cwd(), 'src', 'utils', 'email-templates', 'templates') // Dev (ts-node)
  ]

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path
    }
  }

  // Last-resort fallback.
  return join(__dirname, 'templates')
}

/**
 * Load and compile a template
 */
const loadTemplate = (templateName: string): doT.RenderFunction => {
  // Check cache first
  if (templateCache.has(templateName)) {
    return templateCache.get(templateName)!
  }

  const templatesDir = getTemplatesDir()
  const templatePath = join(templatesDir, `${templateName}.dot`)

  try {
    const templateContent = readFileSync(templatePath, 'utf-8')
    const compiledTemplate = doT.template(templateContent)

    // Cache the compiled template
    templateCache.set(templateName, compiledTemplate)

    logger.debug(`Template loaded and cached: ${templateName}`)
    return compiledTemplate
  } catch (error) {
    logger.error(`Failed to load template: ${templateName}`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: templatePath
    })
    throw new Error(`Template not found: ${templateName}`)
  }
}

/**
 * Load all templates from the templates directory
 */
export const loadAllTemplates = (): void => {
  const templatesDir = getTemplatesDir()

  try {
    const files = readdirSync(templatesDir)
    const templateFiles = files.filter(file => file.endsWith('.dot'))

    templateFiles.forEach(file => {
      const templateName = file.replace('.dot', '')
      try {
        loadTemplate(templateName)
        logger.debug(`Preloaded template: ${templateName}`)
      } catch (error) {
        logger.warn(`Failed to preload template: ${templateName}`, {
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    })

    logger.info(`Loaded ${templateCache.size} email templates`)
  } catch (error) {
    logger.warn('Templates directory not found or inaccessible', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: templatesDir
    })
  }
}

/**
 * Clear the template cache
 */
export const clearTemplateCache = (): void => {
  templateCache.clear()
  logger.debug('Template cache cleared')
}

/**
 * Render a template with data, optionally using a layout
 */
export const renderTemplate = (templateName: string, data: Record<string, any> = {}, useLayout: boolean = true): string => {
  try {
    const templatesDir = getTemplatesDir()
    const contentTemplatePath = join(templatesDir, `${templateName}.dot`)

    // Determine layout template name based on content template type
    // If templateName ends with .html, use layout.html, otherwise use layout.text
    const isHtmlTemplate = templateName.endsWith('.html')
    const layoutTemplateName = isHtmlTemplate ? 'layout.html' : 'layout.text'
    const layoutTemplatePath = join(templatesDir, `${layoutTemplateName}.dot`)

    // Check if content template exists
    const hasContentTemplate = existsSync(contentTemplatePath)
    const hasLayoutTemplate = existsSync(layoutTemplatePath) && useLayout

    if (!hasContentTemplate) {
      throw new Error(`Template not found: ${templateName}`)
    }

    // Load and render content template
    const contentTemplate = loadTemplate(templateName)
    const content = contentTemplate(data)

    // If layout exists and should be used, wrap content in layout
    if (hasLayoutTemplate) {
      const layoutTemplate = loadTemplate(layoutTemplateName)
      // Pass content to layout via data
      return layoutTemplate({ ...data, content })
    }

    // Return content as-is if no layout
    return content
  } catch (error) {
    logger.error(`Failed to render template: ${templateName}`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      dataKeys: Object.keys(data)
    })
    throw error
  }
}

/**
 * Render both HTML and text versions of a template
 */
export const renderTemplatePair = (
  templateName: string,
  data: Record<string, any> = {},
  useLayout: boolean = true
): { html: string; text: string } => {
  const html = renderTemplate(`${templateName}.html`, data, useLayout)
  let text: string

  try {
    text = renderTemplate(`${templateName}.text`, data, useLayout)
  } catch (error) {
    // If text template doesn't exist, generate a plain text version from HTML
    logger.debug(`Text template not found for ${templateName}, generating from HTML`)
    text = html
      .replace(/<[^>]+>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim()
  }

  return { html, text }
}

/**
 * Send an email using a template
 */
export const sendTemplatedEmail = async (
  to: string | string[],
  templateName: string,
  data: Record<string, any> = {},
  app?: any,
  options?: {
    subject?: string
    cc?: string | string[]
    bcc?: string | string[]
    replyTo?: string
    useLayout?: boolean
    attachments?: Array<{
      filename: string
      path?: string
      content?: string | Buffer
      contentType?: string
    }>
  }
): Promise<void> => {
  try {
    const useLayout = options?.useLayout !== false // Default to true

    // Inject common data
    const clientUrl = getClientHost(app)
    const appName = app?.get('appName') || 'API'
    const templateData = {
      ...data,
      clientUrl,
      logoUrl: `${clientUrl}/logo.png`,
      appName
    }

    const { html, text } = renderTemplatePair(templateName, templateData, useLayout)

    // Get subject from template data or options, or use template name as fallback
    const subject = options?.subject || data.subject || templateName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

    await sendMail(
      {
        to,
        subject,
        html,
        text,
        cc: options?.cc,
        bcc: options?.bcc,
        replyTo: options?.replyTo,
        attachments: options?.attachments
      },
      app
    )
  } catch (error) {
    logger.error(`Failed to send templated email: ${templateName}`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      to,
      dataKeys: Object.keys(data)
    })
    throw error
  }
}

/**
 * Get the client host URL from app configuration
 * Used for building links in email templates
 */
export const getClientHost = (app?: any): string => {
  if (!app) {
    logger.warn('App not provided to getClientHost, using default')
    return 'http://localhost:5173'
  }
  return app.get('clientHost') || 'http://localhost:5173'
}

/**
 * Build a URL using the configured client host
 * Useful for building links in email templates
 */
export const buildClientUrl = (app: any, path: string): string => {
  const baseUrl = getClientHost(app)
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl}${normalizedPath}`
}

/**
 * Get list of available templates
 */
export const getAvailableTemplates = (): string[] => {
  const templatesDir = getTemplatesDir()

  try {
    const files = readdirSync(templatesDir)
    const templateFiles = files
      .filter(file => file.endsWith('.dot'))
      .map(file => file.replace('.dot', ''))
      .filter(name => !name.endsWith('.text') && !name.endsWith('.html'))

    return [...new Set(templateFiles)] // Remove duplicates
  } catch (error) {
    logger.warn('Failed to list templates', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return []
  }
}

