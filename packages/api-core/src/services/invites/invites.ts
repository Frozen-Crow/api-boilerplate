// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { generateDefaultHooks } from '../../utils/generate-hooks'
import { resolveServiceSchema, withExtensionHooks } from '../../utils/extend-service'
import { teamAccessControl } from '../../utils/team-access-control'

import {
  invitesDataSchema,
  invitesPatchSchema,
  invitesQueryProperties,
  invitesDataValidator,
  invitesPatchValidator,
  invitesQueryValidator,
  invitesResolver,
  invitesExternalResolver,
  invitesDataResolver,
  invitesPatchResolver,
  invitesQueryResolver
} from './invites.schema'

import type { Application } from '../../declarations'
import { InvitesService, getOptions } from './invites.class'
import { invitesPath, invitesMethods } from './invites.shared'
import { createVerificationForInvite, handleInviteAcceptance, guardInvitePatch } from './invites.hooks'

export * from './invites.class'
export * from './invites.schema'

// A configure function that registers the service and its hooks via `app.configure`
export const invites = (app: Application) => {
  // Register our service on the Feathers application
  app.use(invitesPath, new InvitesService(getOptions(app)), {
    // A list of all methods this service exposes externally
    methods: invitesMethods,
    // You can add additional custom events to be sent to clients here
    events: []
  })

  // Generate hooks using our utility
  const hooks = generateDefaultHooks({
    schema: resolveServiceSchema(app, invitesPath, {
      dataSchema: invitesDataSchema,
      patchSchema: invitesPatchSchema,
      queryProperties: invitesQueryProperties,
      dataValidator: invitesDataValidator,
      patchValidator: invitesPatchValidator,
      queryValidator: invitesQueryValidator,
      dataResolver: invitesDataResolver,
      patchResolver: invitesPatchResolver,
      queryResolver: invitesQueryResolver,
      externalResolver: invitesExternalResolver,
      resultResolver: invitesResolver
    }),
    // Require authentication for all operations
    requireAuth: true,
    accessControl: {
      methods: ['get', 'find', 'create', 'remove'],
      mode: teamAccessControl
    },
    extensions: withExtensionHooks(app, invitesPath, {
      before: {
        patch: [guardInvitePatch]
      },
      after: {
        create: [createVerificationForInvite],
        patch: [handleInviteAcceptance]
      }
    })
  })

  // Initialize hooks
  app.service(invitesPath).hooks(hooks)
}

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    [invitesPath]: any
  }
}