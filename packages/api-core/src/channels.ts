// For more information about this file see https://dove.feathersjs.com/guides/cli/channels.html
import type { RealTimeConnection, Params } from '@feathersjs/feathers'
import type { AuthenticationResult } from '@feathersjs/authentication'
import '@feathersjs/transport-commons'
import type { Application, HookContext } from './declarations'

/**
 * Extension points for the core's realtime channel setup. Pass as the
 * `channels` option to `createApp` / `createConfiguredApp` / `configureCore`:
 *
 * ```ts
 * createConfiguredApp({
 *   channels: {
 *     onLogin: (authResult, connection, app) => {
 *       app.channel(`team/${authResult.user.teamId}`).join(connection)
 *     },
 *     publish: (data, context) => {
 *       if (context.path === 'announcements') return context.app.channel('authenticated')
 *       // return undefined to fall through to the default tenant-scoped publisher
 *     }
 *   }
 * })
 * ```
 *
 * Alternatively pass `channels: (app) => { ... }` to replace the setup entirely,
 * or `channels: false` to disable it and configure your own. Per-service
 * publishers (`app.service('x').publish(...)`) always override the global
 * publisher for that service — that Feathers extension point works regardless.
 */
export interface ChannelsOptions {
  /** Called for every new realtime connection, after it joins `anonymous`. */
  onConnection?: (connection: RealTimeConnection, app: Application) => void
  /**
   * Called on login, after the default joins (`authenticated`, `userId/<id>`,
   * `org/<activeOrganization>`). Join your own channels here.
   */
  onLogin?: (authResult: AuthenticationResult, connection: RealTimeConnection, app: Application) => void
  /**
   * Custom publisher. Return a channel (or array of channels) to publish the
   * event there instead of the default; return undefined/null to fall through
   * to the default tenant-scoped publisher.
   */
  publish?: (data: any, context: HookContext) => any
}

/**
 * The default multitenant-safe publisher: deliver an event only to connections
 * in the same organization as the affected resource. Events without tenant
 * scope go only to the affected user (for the users service) and are otherwise
 * NOT broadcast, so one tenant can never observe another tenant's realtime
 * activity.
 */
export const defaultPublisher = (app: Application) => (data: any, context: HookContext) => {
  const orgId = data?.organizationId || data?.activeOrganization

  if (orgId) {
    return app.channel(`org/${String(orgId)}`)
  }

  if (context.path === 'users' && data?._id) {
    return app.channel(`userId/${String(data._id)}`)
  }

  // Unknown / unscoped payloads are not broadcast to everyone.
  return []
}

/**
 * Compose a custom publisher with the default tenant-scoped fallback.
 * Exported separately so the composition is testable.
 */
export const buildPublisher = (app: Application, options: ChannelsOptions = {}) => {
  const fallback = defaultPublisher(app)
  return (data: any, context: HookContext) => {
    if (options.publish) {
      const result = options.publish(data, context)
      if (result !== undefined && result !== null) {
        return result
      }
    }
    return fallback(data, context)
  }
}

/**
 * Configure the core channel setup, optionally extended via `ChannelsOptions`.
 */
export const configureChannels = (options: ChannelsOptions = {}) => (app: Application) => {
  app.on('connection', (connection: RealTimeConnection) => {
    // On a new real-time connection, add it to the anonymous channel
    app.channel('anonymous').join(connection)
    options.onConnection?.(connection, app)
  })

  app.on('login', (authResult: AuthenticationResult, { connection }: Params) => {
    // connection can be undefined if there is no
    // real-time connection, e.g. when logging in via REST
    if (connection) {
      // The connection is no longer anonymous, remove it
      app.channel('anonymous').leave(connection)

      // Add it to the authenticated user channel
      app.channel('authenticated').join(connection)

      const user = (authResult as any).user
      if (user?._id) {
        // A per-user channel so a user always receives events about their own
        // record even if it carries no organization scope.
        app.channel(`userId/${String(user._id)}`).join(connection)
      }
      // A per-organization channel enforces tenant isolation over websockets:
      // a connection only receives events for the organization it is scoped to.
      if (user?.activeOrganization) {
        app.channel(`org/${String(user.activeOrganization)}`).join(connection)
      }

      options.onLogin?.(authResult, connection, app)
    }
  })

  app.publish(buildPublisher(app, options))
}

// Back-compat: the plain configure function with default behavior.
export const channels = (app: Application) => configureChannels()(app)
