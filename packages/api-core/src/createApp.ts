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
import { channels } from './channels'
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
export const configureCore = (app: Application, options?: CoreOptions): Application => {
  // Programmatic path: map `options` onto the same Feathers config keys the
  // config module would populate.
  if (options) {
    const config = resolveConfiguration(options)
    for (const [key, value] of Object.entries(config)) {
      if (value !== undefined) {
        app.set(key as any, value as any)
      }
    }
    app.set('coreOptions', options)
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
  app.use(bodyParser())
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
  app.configure(channels)

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
        async () => {
          await seed(app, roles)
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
 * Create an app configured from the Feathers **config module** — i.e. from
 * `config/*.json` (+ `config/local.json` for secrets, + env vars mapped in
 * `config/custom-environment-variables.json`). This is the recommended setup:
 * no `.env` files, and consumers can extend the config schema with their own keys.
 *
 * ```ts
 * import { createConfiguredApp } from '@frozencrow/api-core'
 * const app = createConfiguredApp()
 * app.configure(myServices)
 * await app.listen(app.get('port'))
 * ```
 *
 * Pass a custom validator if you extend the configuration schema.
 */
export const createConfiguredApp = (validator: any = configurationValidator): Application => {
  const app: Application = koa(feathers())
  app.configure(configuration(validator))
  return configureCore(app)
}
