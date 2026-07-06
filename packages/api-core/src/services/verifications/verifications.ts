// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { disallow } from 'feathers-hooks-common'
import { generateDefaultHooks } from '../../utils/generate-hooks'
import { restrictExternalVerificationCreate } from './verifications.hooks'

import {
  verificationsDataValidator,
  verificationsPatchValidator,
  verificationsQueryValidator,
  verificationsResolver,
  verificationsExternalResolver,
  verificationsDataResolver,
  verificationsPatchResolver,
  verificationsQueryResolver
} from './verifications.schema'

import type { Application } from '../../declarations'
import { VerificationsService, getOptions } from './verifications.class'
import { verificationsPath, verificationsMethods } from './verifications.shared'
import {
  generateVerificationToken,
  sendVerificationEmail,
  markVerificationAsUsed,
  handlePasswordReset
} from './verifications.hooks'

export * from './verifications.class'
export * from './verifications.schema'
export * from './verifications.hooks'
export * from './verifications.utils'

// A configure function that registers the service and its hooks via `app.configure`
export const verifications = (app: Application) => {
  // Register our service on the Feathers application
  app.use(verificationsPath, new VerificationsService(getOptions(app)), {
    // A list of all methods this service exposes externally
    methods: verificationsMethods,
    // You can add additional custom events to be sent to clients here
    events: []
  })

  // Generate hooks using our utility
  const hooks = generateDefaultHooks({
    schema: {
      dataValidator: verificationsDataValidator,
      patchValidator: verificationsPatchValidator,
      queryValidator: verificationsQueryValidator,
      dataResolver: verificationsDataResolver,
      patchResolver: verificationsPatchResolver,
      queryResolver: verificationsQueryResolver,
      externalResolver: verificationsExternalResolver,
      resultResolver: verificationsResolver
    },
    // Verifications service should allow anonymous access for password reset and magic links
    requireAuth: false,
    allowAnonymous: true,
    accessControl: {
      methods: [], // No access control needed for verifications
      mode: 'ignore'
    },
    extensions: {
      before: {
        // Verification records hold secret tokens (password-reset / magic-link /
        // invite). They are looked up server-side via the verifyToken util, so
        // there is never a legitimate reason to read or delete them from the
        // outside. Blocking external find/get/remove closes token enumeration
        // and account-takeover vectors.
        find: [disallow('external')],
        get: [disallow('external')],
        remove: [disallow('external')],
        create: [restrictExternalVerificationCreate, generateVerificationToken]
      },
      around: {
        patch: [handlePasswordReset]
      },
      after: {
        create: [sendVerificationEmail]
      }
    }
  })

  // Initialize hooks
  app.service(verificationsPath).hooks(hooks)
}

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    [verificationsPath]: VerificationsService
  }
}
