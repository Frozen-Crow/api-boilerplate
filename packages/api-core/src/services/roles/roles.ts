import { generateDefaultHooks } from '../../utils/generate-hooks'
import { resolveServiceSchema } from '../../utils/extend-service'
import { requireGlobalAdmin } from '../../hooks/require-global-admin'

import {
    rolesDataSchema,
    rolesPatchSchema,
    rolesQueryProperties,
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
        schema: resolveServiceSchema(app, rolesPath, {
            dataSchema: rolesDataSchema,
            patchSchema: rolesPatchSchema,
            queryProperties: rolesQueryProperties,
            dataValidator: rolesDataValidator,
            patchValidator: rolesPatchValidator,
            queryValidator: rolesQueryValidator,
            dataResolver: rolesDataResolver,
            patchResolver: rolesPatchResolver,
            queryResolver: rolesQueryResolver,
            externalResolver: rolesExternalResolver,
            resultResolver: rolesResolver
        }),
        accessControl: {
            // Roles are GLOBAL (shared across all tenants), so team/org-scoped
            // access control does not apply — reads (find/get) stay open to any
            // authenticated user because populate-user-roles and the org
            // permission checks need them. Writes are NOT open: the
            // requireGlobalAdmin guards below restrict create/update/patch/remove
            // to global admins (a shared write otherwise affects every tenant).
            mode: 'ignore'
        },
        extensions: {
            before: {
                create: [requireGlobalAdmin()],
                update: [requireGlobalAdmin()],
                patch: [requireGlobalAdmin()],
                remove: [requireGlobalAdmin()]
            }
        }
    }))
}

declare module '../../declarations' {
    interface ServiceTypes {
        [rolesPath]: Roles
    }
}
