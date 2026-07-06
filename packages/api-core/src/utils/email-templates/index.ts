/**
 * Email Templates Module
 * 
 * Exports all template management functions
 */

export {
  renderTemplate,
  renderTemplatePair,
  sendTemplatedEmail,
  loadAllTemplates,
  clearTemplateCache,
  getAvailableTemplates,
  getClientHost,
  buildClientUrl,
  setTemplatesDir
} from './template-manager'

