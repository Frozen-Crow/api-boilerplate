/**
 * @frozencrow/api-core
 *
 * A batteries-included Feathers 5 + Koa + MongoDB core: authentication
 * (local / JWT / Google / API key / anonymous), a repeatable service + hook
 * generation system, RBAC, and multitenant (organization) access control.
 *
 * Quick start:
 * ```ts
 * import { createApp } from '@frozencrow/api-core'
 * const app = createApp({ mongodb: process.env.MONGODB_URI!, authSecret: process.env.AUTH_SECRET!, seed: true })
 * await app.listen(app.get('port'))
 * ```
 */

// App factory & configuration
export { createApp, createConfiguredApp, configureCore } from './createApp'
export type { ConfiguredAppOptions } from './createApp'
export { resolveConfiguration } from './options'
export type { CoreOptions, CoreSeedRole } from './options'
export { configurationSchema, configurationValidator } from './configuration'
export type { ApplicationConfiguration } from './configuration'

// Core types
export type { Application, HookContext, NextFunction } from './declarations'

// Service registration
export { coreServices, services, ALL_CORE_SERVICES } from './services/index'
export type { CoreServiceName } from './services/index'

// Infrastructure configure functions (advanced composition)
export { authentication } from './authentication'
export { channels, configureChannels, buildPublisher, defaultPublisher } from './channels'
export type { ChannelsOptions } from './channels'
export { mongodb } from './mongodb'
export { seed, DEFAULT_SEED_ROLES } from './seed'
export { logger } from './logger'
export { dataValidator, queryValidator } from './validators'

// Hook generation system — the primary extension point for custom services
export { generateHooks, generateDefaultHooks } from './utils/generate-hooks'

// Extending built-in services (schema fields, resolvers, hooks)
export { resolveServiceSchema, withExtensionHooks } from './utils/extend-service'
export type { ServiceExtension, CoreExtend, ServiceSchemaBase } from './utils/extend-service'

// Access control
export { isGlobalAdmin, assertOrgMembership, assertOrgPermission } from './utils/access'
export { teamAccessControl } from './utils/team-access-control'
export { accessControl, accessControlResolver, allowAnonymous } from './utils/auth'

// Reusable hooks
export { populateUserRoles } from './hooks/populate-user-roles'
export { preventRoleChange } from './hooks/prevent-role-change'
export { filterOrganizationsByMembership } from './hooks/filter-organizations'
export { filterUsersByOrganization } from './hooks/filter-users'
export { setupOrganization, ensureUserHasOrganization } from './hooks/setup-organization'
export { logError } from './hooks/log-error'
export { discardVirtualProps } from './utils/discard-virtual-props'
export { storeOriginalRequestData, removeInjectedDefaults } from './utils/strip-default-values'
export { generateShortId } from './utils/generate-id'

// Mail & email templates
export * from './utils/mail'
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
} from './utils/email-templates'

// Authentication strategies
export { CustomJWTStrategy, ApiKeyStrategy } from './strategies/local'
export { AnonymousStrategy } from './strategies/anonymous'
export { GoogleStrategy, GoogleOneTapStrategy } from './strategies/google'

// Built-in services, namespaced so consumers can compose their schemas / hooks.
// e.g. `import { usersService } from '@frozencrow/api-core'` -> usersService.userSchema
export * as usersService from './services/users/users'
export * as organizationsService from './services/organizations/organizations'
export * as rolesService from './services/roles/roles'
export * as serialIdsService from './services/serial-ids/serial-ids'
export * as invitesService from './services/invites/invites'
export * as verificationsService from './services/verifications/verifications'
