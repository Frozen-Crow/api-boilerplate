import { generateDefaultHooks } from '../../utils/generate-hooks'
import { resolveServiceSchema, withExtensionHooks } from '../../utils/extend-service'
import { populateUserRoles } from '../../hooks/populate-user-roles'
import { preventRoleChange } from '../../hooks/prevent-role-change'
import { restrictUserToSelf } from '../../hooks/restrict-user-to-self'

import {
  userDataSchema,
  userPatchSchema,
  userQueryProperties,
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
  // Initialize hooks (schema + hooks honor any `extend.users` option)
  app.service(userPath).hooks(generateDefaultHooks({
    schema: resolveServiceSchema(app, userPath, {
      dataSchema: userDataSchema,
      patchSchema: userPatchSchema,
      queryProperties: userQueryProperties,
      dataValidator: userDataValidator,
      patchValidator: userPatchValidator,
      queryValidator: userQueryValidator,
      dataResolver: userDataResolver,
      patchResolver: userPatchResolver,
      queryResolver: userQueryResolver,
      externalResolver: userExternalResolver,
      resultResolver: userResolver
    }),
    accessControl: {
      methods: ['find', 'get', 'update', 'patch', 'remove'],
      mode: 'restrictToUser',
      restrictToUserAs: '_id'
    },
    allowAnonymous: true,
    extensions: withExtensionHooks(app, userPath, {
      before: {
        // - restrictUserToSelf: scope by-id reads/writes to the caller's own
        //   record — without it, any authenticated user could read/modify/delete
        //   another user by id (see restrict-user-to-self.ts).
        // - preventRoleChange: strip role / verification / identity fields from
        //   external non-admin writes (see prevent-role-change.ts).
        get: [restrictUserToSelf()],
        remove: [restrictUserToSelf()],
        create: [preventRoleChange()],
        update: [restrictUserToSelf(), preventRoleChange()],
        patch: [restrictUserToSelf(), preventRoleChange()]
      }
    })
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
