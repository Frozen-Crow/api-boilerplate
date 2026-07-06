// For more information about this file see https://dove.feathersjs.com/guides/cli/authentication.html
import { AuthenticationService, JWTStrategy } from '@feathersjs/authentication'
import { LocalStrategy } from '@feathersjs/authentication-local'
import { oauth, OAuthStrategy } from '@feathersjs/authentication-oauth'

import type { Application } from './declarations'
import { AnonymousStrategy } from './strategies/anonymous'
import { GoogleStrategy, GoogleOneTapStrategy } from './strategies/google'
import { CustomJWTStrategy, ApiKeyStrategy } from './strategies/local'

declare module './declarations' {
  interface ServiceTypes {
    authentication: AuthenticationService
  }
}

// The placeholder shipped in config/default.json. Booting production with this
// (or any weak secret) means anyone can forge JWTs, so we refuse to start.
const PLACEHOLDER_SECRET = 'CHANGE_ME_IN_PRODUCTION'

const assertStrongSecret = (app: Application) => {
  const secret = (app.get('authentication') as any)?.secret
  const isProduction = process.env.NODE_ENV === 'production'

  if (isProduction && (!secret || secret === PLACEHOLDER_SECRET || String(secret).length < 32)) {
    throw new Error(
      'Refusing to start: a strong authentication secret is required in production. ' +
        'Set the AUTH_SECRET environment variable to a random value of at least 32 characters.'
    )
  }

  if (!isProduction && (!secret || secret === PLACEHOLDER_SECRET)) {
    // eslint-disable-next-line no-console
    console.warn(
      '[auth] Using the default development JWT secret. Set AUTH_SECRET before deploying to production.'
    )
  }
}

export const authentication = (app: Application) => {
  assertStrongSecret(app)

  const authentication = new AuthenticationService(app)

  // Register custom strategies
  authentication.register('jwt', new CustomJWTStrategy())
  authentication.register('local', new LocalStrategy())
  authentication.register('google', new GoogleStrategy())
  authentication.register('google-one-tap', new GoogleOneTapStrategy())
  authentication.register('anonymous', new AnonymousStrategy())
  authentication.register('api-key', new ApiKeyStrategy(app))

  app.use('authentication', authentication)
  app.configure(oauth())

  app.service('authentication').hooks({
    after: {
      create: [
        async (context: any) => {
          const { user } = context.result
          if (user && !user.activeOrganization) {
            const { ensureUserHasOrganization } = await import('./hooks/setup-organization')
            context.result.user = await ensureUserHasOrganization(context.app, user)
          }
          return context
        }
      ]
    }
  })
}
