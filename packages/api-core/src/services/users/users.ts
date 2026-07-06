import { authenticate } from '@feathersjs/authentication'
import { generateDefaultHooks } from '../../utils/generate-hooks'
import { populateUserRoles } from '../../hooks/populate-user-roles'
import { preventRoleChange } from '../../hooks/prevent-role-change'

import { hooks as schemaHooks } from '@feathersjs/schema'

import {
  userDataValidator,
  userPatchValidator,
  userQueryValidator,
  userResolver,
  userExternalResolver,
  userDataResolver,
  userPatchResolver,
  userQueryResolver
} from './users.schema'

import type { Application } from '../../declarations'
import { UserService, getOptions } from './users.class'
import { userPath, userMethods } from './users.shared'

export * from './users.class'
export * from './users.schema'

// A configure function that registers the service and its hooks via `app.configure`
export const user = (app: Application) => {
  // Register our service on the Feathers application
  app.use(userPath, new UserService(getOptions(app), app), {
    // A list of all methods this service exposes externally
    methods: userMethods,
    // You can add additional custom events to be sent to clients here
    events: []
  })
  // Initialize hooks
  app.service(userPath).hooks(generateDefaultHooks({
    schema: {
      dataValidator: userDataValidator,
      patchValidator: userPatchValidator,
      queryValidator: userQueryValidator,
      dataResolver: userDataResolver,
      patchResolver: userPatchResolver,
      queryResolver: userQueryResolver,
      externalResolver: userExternalResolver,
      resultResolver: userResolver
    },
    accessControl: {
      methods: ['find', 'get', 'update', 'patch', 'remove'],
      mode: 'restrictToUser',
      restrictToUserAs: '_id'
    },
    allowAnonymous: true,
    extensions: {
      before: {
        // Prevent self privilege-escalation: strip role / verification / identity
        // fields from external non-admin writes (see prevent-role-change.ts).
        create: [preventRoleChange()],
        update: [preventRoleChange()],
        patch: [preventRoleChange()]
      }
    }
  }))

  app.service(userPath).hooks({
    after: {
      find: [populateUserRoles()],
      get: [populateUserRoles()]
    }
  })
}

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    [userPath]: UserService
  }
}
