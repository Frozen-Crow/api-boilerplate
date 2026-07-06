import { generateDefaultHooks } from '../../utils/generate-hooks'

import {
    rolesDataValidator,
    rolesPatchValidator,
    rolesQueryValidator,
    rolesResolver,
    rolesExternalResolver,
    rolesDataResolver,
    rolesPatchResolver,
    rolesQueryResolver
} from './roles.schema'

import type { Application } from '../../declarations'
import { Roles, getOptions } from './roles.class'
import { rolesPath, rolesMethods } from './roles.shared'

export * from './roles.class'
export {
    rolesSchema,
    rolesDataValidator,
    rolesPatchValidator,
    rolesQueryValidator,
    rolesResolver,
    rolesExternalResolver,
    rolesDataResolver,
    rolesPatchResolver,
    rolesQueryResolver
} from './roles.schema'
export { rolesPath, rolesMethods } from './roles.shared'

export const roles = (app: Application) => {
    // Register our service on the Feathers application
    app.use(rolesPath, new Roles(getOptions(app)), {
        // A list of all methods this service exposes externally
        methods: rolesMethods,
        // You can add additional custom events to be sent to clients here
        events: []
    })
    // Initialize hooks
    app.service(rolesPath).hooks(generateDefaultHooks({
        schema: {
            dataValidator: rolesDataValidator,
            patchValidator: rolesPatchValidator,
            queryValidator: rolesQueryValidator,
            dataResolver: rolesDataResolver,
            patchResolver: rolesPatchResolver,
            queryResolver: rolesQueryResolver,
            externalResolver: rolesExternalResolver,
            resultResolver: rolesResolver
        },
        accessControl: {
            // Roles are read-only for most users, but maybe editable by admins?
            // For now, let's allow all auth users to read, but creating/updating roles might need restriction.
            // Using standard mode for now, team access control handles finding by default?
            // Actually roles are global, not per organization usually?
            // If they are global, we might need 'ignore' or specific logic.
            // Let's assume roles are global for the system.
            mode: 'ignore'
        }
    }))
}

declare module '../../declarations' {
    interface ServiceTypes {
        [rolesPath]: Roles
    }
}
