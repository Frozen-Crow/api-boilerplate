import { feathers } from '@feathersjs/feathers'
import configuration from '@feathersjs/configuration'
import { koa, rest, bodyParser, errorHandler, parseAuthentication, cors, serveStatic } from '@feathersjs/koa'
import socketio from '@feathersjs/socketio'

import type { Application } from './declarations'
import type { CoreOptions } from './options'
import { resolveConfiguration } from './options'
import { configurationValidator } from './configuration'
import { logError } from './hooks/log-error'
import { mongodb } from './mongodb'
import { authentication } from './authentication'
import { coreServices } from './services/index'
import { configureChannels } from './channels'
import { seed } from './seed'
import { setTemplatesDir } from './utils/email-templates'

declare module './declarations' {
  interface Configuration {
    coreOptions: CoreOptions
  }
}

/**
 * Apply the full API core (transports, MongoDB, authentication, services,
 * channels, error logging, optional seed) onto an existing Feathers + Koa
 * application.
 *
 * Configuration is read from the application (`app.get(...)`), so this works
 * whether you loaded config via `@feathersjs/configuration` (the config module,
 * recommended) or by passing `options`. When both are present, `options` wins.
 *
 * Config-module usage (no `.env` — secrets come from `config/local.json` or the
 * env mapping in `config/custom-environment-variables.json`):
 * ```ts
 * const app = koa(feathers())
 * app.configure(configuration(configurationValidator))
 * app.configure(configureCore)
 * ```
 */
export const configureCore = (app: Application, options?: Partial<CoreOptions>): Application => {
  // Programmatic path: map `options` onto the same Feathers config keys the
  // config module would populate. Behavior-only options (channels, services,
  // defaultOrgName, …) may be passed WITHOUT mongodb/authSecret when the
  // connection config comes from the config module.
  if (options) {
    if (options.mongodb !== undefined || options.authSecret !== undefined) {
      const config = resolveConfiguration(options as CoreOptions)
      for (const [key, value] of Object.entries(config)) {
        if (value !== undefined) {
          app.set(key as any, value as any)
        }
      }
    }
    app.set('coreOptions', options as CoreOptions)
  }

  // Validate required configuration is present, from whichever source.
  if (!app.get('mongodb')) {
    throw new Error(
      'configureCore: no `mongodb` connection string is configured. Set it in config/*.json (config module) or pass `mongodb` to createApp().'
    )
  }
  const authConfig = app.get('authentication') as any
  if (!authConfig?.secret) {
    throw new Error(
      'configureCore: no `authentication.secret` is configured. Set it in config (e.g. config/local.json) or pass `authSecret` to createApp().'
    )
  }

  const templatesDir = options?.templatesDir || (app.get('templatesDir') as unknown as string | undefined)
  if (templatesDir) {
    setTemplatesDir(templatesDir)
  }

  const allowedOrigins = (app.get('origins') as string[]) || []

  // CORS restricted to configured origins.
  app.use(
    cors({
      origin: (ctx: any) => {
        const requestOrigin = ctx.get('Origin')
        return allowedOrigins.includes(requestOrigin) ? requestOrigin : ''
      },
      credentials: true
    })
  )

  const publicDir = app.get('public')
  if (publicDir) {
    app.use(serveStatic(publicDir))
  }
  app.use(errorHandler())
  // Body parser options (e.g. { jsonLimit: '8mb' }) from the option or config.
  const bodyParserOptions = options?.bodyParser ?? (app.get('bodyParser' as any) as any)
  app.use(bodyParser(bodyParserOptions))
  app.use(parseAuthentication())

  app.configure(rest())
  app.configure(
    socketio({
      cors: { origin: allowedOrigins }
    })
  )
  app.configure(mongodb)
  app.configure(authentication)
  app.configure(coreServices(options?.services))

  // Realtime channels: extend (ChannelsOptions), replace (function), disable
  // (false), or default tenant-scoped setup.
  const channelsOption = options?.channels
  if (channelsOption !== false) {
    app.configure(
      typeof channelsOption === 'function' ? channelsOption : configureChannels(channelsOption)
    )
  }

  // Error logging around every service method.
  app.hooks({
    around: { all: [logError] },
    before: {},
    after: {},
    error: {}
  })

  // Optional startup seeding of default roles (opt in via `seed` option or the
  // `seed` config key).
  const seedConfig = options?.seed ?? (app.get('seed') as unknown as boolean | { roles?: any } | undefined)
  if (seedConfig) {
    const roles = seedConfig === true ? undefined : (seedConfig as any).roles
    app.hooks({
      setup: [
        // Setup hooks are async middleware: (context, next). next() MUST be
        // called or the setup chain stops here — most visibly, socket.io
        // (which wraps app.setup) would never attach to the HTTP server.
        async (_context: any, next: any) => {
          await seed(app, roles)
          await next()
        }
      ],
      teardown: []
    })
  }

  return app
}

/**
 * Create a fully-configured Feathers + Koa application from a `CoreOptions`
 * object. Does not start listening — call `app.listen(port)` yourself.
 *
 * ```ts
 * const app = createApp({ mongodb: process.env.MONGODB_URI!, authSecret: process.env.AUTH_SECRET! })
 * app.configure(myServices)
 * await app.listen(app.get('port'))
 * ```
 */
export const createApp = (options: CoreOptions): Application => {
  const app: Application = koa(feathers())
  return configureCore(app, options)
}

/**
 * Options for `createConfiguredApp`: any behavior options from `CoreOptions`
 * (channels, services, defaultOrgName, seed, templatesDir, …) plus an optional
 * `validator` for an extended configuration schema. Connection config
 * (mongodb, secret, origins, …) comes from the config module files.
 */
export type ConfiguredAppOptions = Partial<CoreOptions> & { validator?: any }

/**
 * Create an app configured from the Feathers **config module** — i.e. from
 * `config/*.json` (+ `config/local.json` for secrets, + env vars mapped in
 * `config/custom-environment-variables.json`). This is the recommended setup:
 * no `.env` files, and consumers can extend the config schema with their own keys.
 *
 * ```ts
 * import { createConfiguredApp } from '@frozencrow/api-core'
 * const app = createConfiguredApp({
 *   channels: { onLogin: (auth, conn, app) => app.channel(`team/${auth.user.teamId}`).join(conn) }
 * })
 * app.configure(myServices)
 * await app.listen(app.get('port'))
 * ```
 *
 * Pass `validator` if you extend the configuration schema. (For backwards
 * compatibility, passing a bare validator function is also accepted.)
 */
export const createConfiguredApp = (options?: ConfiguredAppOptions | ((...args: any[]) => any)): Application => {
  // Back-compat: createConfiguredApp(validatorFn)
  const opts: ConfiguredAppOptions = typeof options === 'function' ? { validator: options } : options || {}
  const { validator, ...behavior } = opts

  const app: Application = koa(feathers())
  app.configure(configuration(validator || configurationValidator))
  return configureCore(app, Object.keys(behavior).length > 0 ? behavior : undefined)
}
