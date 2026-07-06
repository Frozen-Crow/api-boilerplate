// For more information about this file see https://dove.feathersjs.com/guides/cli/channels.html
import type { RealTimeConnection, Params } from '@feathersjs/feathers'
import type { AuthenticationResult } from '@feathersjs/authentication'
import '@feathersjs/transport-commons'
import type { Application, HookContext } from './declarations'
import { logger } from './logger'

export const channels = (app: Application) => {
  app.on('connection', (connection: RealTimeConnection) => {
    // On a new real-time connection, add it to the anonymous channel
    app.channel('anonymous').join(connection)
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
    }
  })

  app.publish((data: any, context: HookContext) => {
    // Multitenant-safe publishing: only deliver an event to connections that
    // belong to the same organization as the affected resource. Events that
    // carry no tenant scope are delivered only to the affected user (if any)
    // and are otherwise NOT broadcast, so one tenant can never observe another
    // tenant's realtime activity.
    const orgId = data?.organizationId || data?.activeOrganization

    if (orgId) {
      return app.channel(`org/${String(orgId)}`)
    }

    if (context.path === 'users' && data?._id) {
      return app.channel(`userId/${String(data._id)}`)
    }

    // Unknown / unscoped payloads are not broadcast to everyone.
    return []
  })
}
