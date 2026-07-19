import type { ApplicationConfiguration } from './configuration'
import type { ChannelsOptions } from './channels'
import type { CoreExtend } from './utils/extend-service'

/**
 * Public configuration surface for the library.
 *
 * A consumer never edits our config files — they pass a `CoreOptions` object to
 * `createApp()` (or `configureCore()`), and we map it onto the Feathers config
 * keys the services already read via `app.get(...)`. This keeps the services
 * unchanged while giving consumers a single, typed entry point.
 *
 * Only `mongodb` and `authSecret` are required; everything else has a default.
 */
export interface CoreSeedRole {
  name: string
  permissions: string[]
}

export interface CoreOptions {
  /** MongoDB connection string, e.g. mongodb://localhost:27017/my-app */
  mongodb: string
  /** JWT signing secret. Must be strong (>= 32 chars) in production. */
  authSecret: string

  appName?: string
  host?: string
  port?: number
  /** Absolute or relative path to a static directory to serve. Omit to disable. */
  public?: string
  apiHost?: string
  clientHost?: string
  /** Browser origins allowed by CORS. */
  origins?: string[]
  paginate?: { default: number; max: number }

  /** Overrides merged into the Feathers `authentication.jwtOptions`. */
  jwtOptions?: Record<string, any>
  /** Static API keys accepted by the `api-key` strategy. */
  apiKeys?: string[]
  /** OAuth provider config (currently Google). */
  oauth?: {
    redirect?: { success: string; error: string }
    google?: { key: string; secret: string; scope?: string[] }
  }
  /** Deep overrides merged last into the resolved `authentication` config. */
  authentication?: Record<string, any>

  mail?: {
    host: string
    port: number
    secure?: boolean
    auth?: { user: string; pass: string }
    from?: string
    fromName?: string
  }

  /**
   * Seed default roles on startup. `true` uses the built-in Admin/Member roles;
   * pass `{ roles }` to override. `false`/omit disables seeding.
   */
  seed?: boolean | { roles?: CoreSeedRole[] }

  /** Directory of `.dot` email templates that overrides the bundled ones. */
  templatesDir?: string
  /** Names the default organization created for a brand-new user. */
  defaultOrgName?: (user: any) => string

  /**
   * Which built-in services to register. Defaults to all of them. Pass a subset
   * to drop services you don't need (e.g. omit 'invites' and 'verifications').
   */
  services?: Array<'users' | 'organizations' | 'roles' | 'serial-ids' | 'invites' | 'verifications'>

  /**
   * Realtime channel setup. Defaults to the core's tenant-scoped channels.
   * - `ChannelsOptions` — extend the defaults (`onConnection`, `onLogin`, `publish`)
   * - `(app) => void` — replace the channel setup entirely
   * - `false` — disable; configure your own channels after `createApp`
   */
  channels?: false | ((app: any) => void) | ChannelsOptions

  /**
   * Extend built-in services with extra schema fields, resolvers, and hooks —
   * keyed by service path (e.g. `users`, `organizations`). See `ServiceExtension`.
   */
  extend?: CoreExtend

  /**
   * Options passed to the Koa body parser. Use `jsonLimit` to allow larger
   * request bodies (default is 1MB), e.g. `{ jsonLimit: '8mb' }`.
   */
  bodyParser?: {
    jsonLimit?: string | number
    formLimit?: string | number
    textLimit?: string | number
    [key: string]: any
  }
}

const DEFAULT_JWT_OPTIONS = {
  header: { typ: 'access' },
  audience: 'https://example.com',
  algorithm: 'HS256',
  expiresIn: '1d'
}

/**
 * Map a `CoreOptions` object onto the fully-formed Feathers application
 * configuration the services expect. The result is validated by
 * `configurationValidator` in `createApp`.
 */
export const resolveConfiguration = (options: CoreOptions): ApplicationConfiguration => {
  if (!options.mongodb) {
    throw new Error('createApp: `mongodb` connection string is required')
  }
  if (!options.authSecret) {
    throw new Error('createApp: `authSecret` is required')
  }

  const authentication: any = {
    entity: 'user',
    service: 'users',
    secret: options.authSecret,
    authStrategies: ['jwt', 'local'],
    jwtOptions: { ...DEFAULT_JWT_OPTIONS, ...options.jwtOptions },
    local: { usernameField: 'email', passwordField: 'password' }
  }

  if (options.apiKeys && options.apiKeys.length > 0) {
    authentication['api-key'] = { allowedKeys: options.apiKeys }
  }

  if (options.oauth) {
    authentication.oauth = {
      redirect: options.oauth.redirect || {
        success: `${options.clientHost || 'http://localhost:5174'}/auth/success`,
        error: `${options.clientHost || 'http://localhost:5174'}/auth/error`
      },
      ...(options.oauth.google
        ? { google: { scope: ['email', 'profile', 'openid'], ...options.oauth.google } }
        : {})
    }
  }

  // Deep-ish merge for the authentication override.
  const mergedAuthentication = options.authentication
    ? { ...authentication, ...options.authentication }
    : authentication

  return {
    appName: options.appName ?? 'API',
    host: options.host ?? 'localhost',
    port: options.port ?? 3030,
    public: options.public ?? './public',
    apiHost: options.apiHost,
    clientHost: options.clientHost,
    origins: options.origins ?? [],
    paginate: options.paginate ?? { default: 10, max: 50 },
    mail: options.mail,
    mongodb: options.mongodb,
    authentication: mergedAuthentication
  } as ApplicationConfiguration
}
