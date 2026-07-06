import { authenticate } from '@feathersjs/authentication'
import { accessControl, accessControlResolver } from './auth'
import { logError } from './log-error'
import { discardVirtualProps } from './discard-virtual-props'
import { hooks as schemaHooks } from '@feathersjs/schema'
import { teamAccessControl } from './team-access-control'
import { storeOriginalRequestData, removeInjectedDefaults } from './strip-default-values'
import type { HookContext } from '../declarations'

interface SchemaObject {
  dataValidator?: any
  patchValidator?: any
  queryValidator?: any
  dataResolver?: any
  patchResolver?: any
  queryResolver?: any
  externalResolver?: any
  resultResolver?: any
}

interface AccessControlConfig {
  methods?: string[]
  mode?: 'restrictToUser' | 'forbidden' | 'ignore' | ((context: any) => any)
  restrictToUserFrom?: string
  restrictToUserAs?: string
  [key: string]: any
}

interface HookOverride {
  around?: {
    all?: any[]
    create?: any[] | undefined
    get?: any[] | undefined
    find?: any[] | undefined
    update?: any[] | undefined
    patch?: any[] | undefined
    remove?: any[] | undefined
    [key: string]: any[] | undefined
  }
  before?: {
    all?: any[]
    create?: any[] | undefined
    get?: any[] | undefined
    find?: any[] | undefined
    update?: any[] | undefined
    patch?: any[] | undefined
    remove?: any[] | undefined
    [key: string]: any[] | undefined
  }
  after?: {
    all?: any[]
    create?: any[] | undefined
    get?: any[] | undefined
    find?: any[] | undefined
    update?: any[] | undefined
    patch?: any[] | undefined
    remove?: any[] | undefined
    [key: string]: any[] | undefined
  }
  error?: {
    all?: any[]
    create?: any[] | undefined
    get?: any[] | undefined
    find?: any[] | undefined
    update?: any[] | undefined
    patch?: any[] | undefined
    remove?: any[] | undefined
    [key: string]: any[] | undefined
  }
}

interface GenerateHooksOptions {
  schema?: SchemaObject
  methods?: string[]
  accessControl?: AccessControlConfig
  overrides?: HookOverride
  extensions?: HookOverride
  requireAuth?: boolean
  logErrors?: boolean
  discardVirtuals?: string[]
  allowAnonymous?: boolean
}

/**
 * Generate hooks object for Feathers services with consistent access control and validation
 */
export const generateHooks = (options: GenerateHooksOptions = {}) => {
  const {
    schema,
    methods = ['find', 'get', 'create', 'update', 'patch', 'remove'],
    accessControl: acConfig = {},
    overrides = {},
    extensions = {},
    requireAuth = true,
    logErrors = true,
    discardVirtuals = ['create', 'update', 'patch'],
    allowAnonymous = false
  } = options

  const {
    methods: acMethods = ['find', 'get', 'create', 'update', 'patch', 'remove'],
    mode,
    restrictToUserFrom = 'params.user._id',
    restrictToUserAs = 'params.query.userId'
  } = acConfig

  // Initialize hooks structure with correct Feathers format
  const hookTypes = ['around', 'before', 'after', 'error']
  const hookMethods = ['all', ...methods]

  const hooks: any = {}
  hookTypes.forEach(type => {
    hooks[type] = {}
    hookMethods.forEach(method => {
      hooks[type][method] = []
    })
  })

  // Helper to safely push hooks to existing method arrays
  const safePush = (type: string, method: string, hook: any) => {
    if (hooks[type] && hooks[type][method]) {
      hooks[type][method].push(hook)
    }
  }

  // Add default hooks
  if (logErrors) {
    hooks.around.all.push(logError)
  }

  // Add allowAnonymous hook before authentication (if enabled)
  if (allowAnonymous) {
    const { allowAnonymous: allowAnonymousHook } = require('../utils/auth')
    hooks.around.all.push(allowAnonymousHook)
  }

  // Add authentication
  if (requireAuth) {
    hooks.before.all.push(authenticate('jwt', 'anonymous'))
  }

  // Add access control
  if (acMethods.length > 0) {
    hooks.around.all.push(accessControl(...acMethods))
    acMethods.forEach(method => {
      // For anonymous access, default to 'ignore' if no mode is provided for read/create methods
      if (allowAnonymous && !mode && (method === 'find' || method === 'get' || method === 'create')) {
        safePush('before', method, accessControlResolver({
          mode: 'ignore' // Ignore access control for public methods when anonymous is allowed and no mode is set
        }))
      } else {
        safePush('before', method, accessControlResolver({
          mode,
          restrictToUserFrom,
          restrictToUserAs
        }))
      }
    })
  }

  // Add schema validation and resolution
  if (schema) {
    // Store original request data for PATCH/UPDATE (before validation)
    safePush('before', 'update', storeOriginalRequestData)
    safePush('before', 'patch', storeOriginalRequestData)

    // Data resolution for create/update/patch (run before validation)
    if (schema.dataResolver) {
      safePush('before', 'create', schemaHooks.resolveData(schema.dataResolver))
    }

    if (schema.patchResolver || schema.dataResolver) {
      const pResolver = schema.patchResolver || schema.dataResolver
      safePush('before', 'update', schemaHooks.resolveData(pResolver))
      safePush('before', 'patch', schemaHooks.resolveData(pResolver))
    }

    // Data validation for create/update/patch
    if (schema.dataValidator) {
      safePush('before', 'create', schemaHooks.validateData(schema.dataValidator))
      safePush('before', 'update', schemaHooks.validateData(schema.dataValidator))
      safePush('before', 'patch', schemaHooks.validateData(schema.patchValidator || schema.dataValidator))
    }

    // Remove default values that were injected during validation (PATCH/UPDATE only)
    safePush('before', 'update', removeInjectedDefaults)
    safePush('before', 'patch', removeInjectedDefaults)

    // Query validation for find
    if (schema.queryValidator) {
      safePush('before', 'find', schemaHooks.validateQuery(schema.queryValidator))
      if (schema.queryResolver) {
        safePush('before', 'find', schemaHooks.resolveQuery(schema.queryResolver))
      }
    }

    // External resolution
    if (schema.externalResolver) {
      hooks.around.all.push(schemaHooks.resolveExternal(schema.externalResolver))
    }

    if (schema.resultResolver) {
      hooks.around.all.push(schemaHooks.resolveResult(schema.resultResolver))
    }

    // Virtual props discarding
    if (discardVirtuals.length > 0) {
      const resolvers: any[] = []
      if (schema.dataResolver) resolvers.push(schema.dataResolver)
      if (schema.patchResolver) resolvers.push(schema.patchResolver)
      if (schema.queryResolver) resolvers.push(schema.queryResolver)

      if (resolvers.length > 0) {
        discardVirtuals.forEach(method => {
          safePush('around', method, discardVirtualProps([method], ...resolvers))
        })
      }
    }
  }

  // Apply overrides
  Object.keys(overrides).forEach((type: string) => {
    const overrideType = overrides[type as keyof HookOverride]
    if (overrideType) {
      Object.keys(overrideType).forEach((method: string) => {
        hooks[type][method] = (overrideType as any)[method]
      })
    }
  })

  // Apply extensions
  Object.keys(extensions).forEach((type: string) => {
    const extensionType = extensions[type as keyof HookOverride]
    if (extensionType) {
      Object.keys(extensionType).forEach((method: string) => {
        hooks[type][method] = hooks[type][method] || []
        hooks[type][method].push(...(extensionType as any)[method])
      })
    }
  })

  return hooks
}

export const generateDefaultHooks = (options: GenerateHooksOptions = {}) => {
  const defaultOptions: GenerateHooksOptions = {
    requireAuth: true,
    logErrors: true,
    discardVirtuals: ['create', 'update', 'patch'],
    ...options,
    accessControl: {
      methods: ['find', 'get', 'create', 'update', 'patch', 'remove'],
      mode: teamAccessControl, // Default to team-based access control
      ...options.accessControl
    }
  }

  return generateHooks(defaultOptions)
} 
