import { generateDefaultHooks } from '../../utils/generate-hooks'

import {
    organizationsDataValidator,
    organizationsPatchValidator,
    organizationsQueryValidator,
    organizationsResolver,
    organizationsExternalResolver,
    organizationsDataResolver,
    organizationsPatchResolver,
    organizationsQueryResolver
} from './organizations.schema'

import type { Application } from '../../declarations'
import { Organizations, getOptions } from './organizations.class'
import { organizationsPath, organizationsMethods } from './organizations.shared'

export * from './organizations.class'
export {
    organizationsSchema,
    organizationsDataValidator,
    organizationsPatchValidator,
    organizationsQueryValidator,
    organizationsResolver,
    organizationsExternalResolver,
    organizationsDataResolver,
    organizationsPatchResolver,
    organizationsQueryResolver
} from './organizations.schema'
export { organizationsPath, organizationsMethods } from './organizations.shared'

import { filterOrganizationsByMembership } from '../../hooks/filter-organizations'
import { authenticate } from '@feathersjs/authentication'

const setOwnerAndMember = async (context: any) => {
    const { app, params, data } = context
    if (params.user && params.user._id) {
        data.ownerId = params.user._id

        // Ensure members array exists
        if (!data.members) {
            data.members = []
        }

        // Check if user is already in members
        const alreadyMember = data.members.some((m: any) => m.userId.toString() === params.user._id.toString())

        if (!alreadyMember) {
            // Find Admin role
            const rolesService = app.service('roles')
            const rolesResult = await rolesService.find({
                query: { name: 'Admin' },
                paginate: false
            })

            let adminRole = rolesResult.length > 0 ? rolesResult[0] : null

            if (!adminRole) {
                adminRole = await rolesService.create({
                    name: 'Admin',
                    permissions: ['*']
                })
            }

            if (adminRole) {
                data.members.push({
                    userId: params.user._id,
                    role: adminRole._id,
                    joinedAt: Date.now()
                })
            }
        }

    } else {
        throw new Error('User is required to create an organization')
    }
    return context
}

const setActiveOrganization = async (context: any) => {
    const { app, result, params } = context
    if (params.user && result._id) {
        await app.service('users').patch(params.user._id, {
            activeOrganization: result._id,
            organizationId: result._id
        })
    }
    return context
}

export const organizations = (app: Application) => {
    // Register our service on the Feathers application
    app.use(organizationsPath, new Organizations(getOptions(app), app), {
        // A list of all methods this service exposes externally
        methods: organizationsMethods,
        // You can add additional custom events to be sent to clients here
        events: []
    })
    // Initialize hooks
    app.service(organizationsPath).hooks(generateDefaultHooks({
        schema: {
            dataValidator: organizationsDataValidator,
            patchValidator: organizationsPatchValidator,
            queryValidator: organizationsQueryValidator,
            dataResolver: organizationsDataResolver,
            patchResolver: organizationsPatchResolver,
            queryResolver: organizationsQueryResolver,
            externalResolver: organizationsExternalResolver,
            resultResolver: organizationsResolver
        },
        overrides: {
            before: {
                all: [authenticate('jwt')]
            }
        },
        extensions: {
            before: {
                create: [setOwnerAndMember],
                find: [filterOrganizationsByMembership()]
            },
            after: {
                create: [setActiveOrganization]
            }
        }
    }))
}

declare module '../../declarations' {
    interface ServiceTypes {
        [organizationsPath]: Organizations
    }
}
