import type { Application, HookContext } from '../declarations'
import { logger } from '../logger'

/**
 * Core logic to ensure a user has an organization and role.
 * Can be called from hooks or directly.
 */
export const ensureUserHasOrganization = async (app: Application, user: any) => {
    if (!user || user.activeOrganization || user.organizationId) {
        return user
    }

    try {
        // 0. Check if user is already a member of any organization (e.g. via invite)
        const orgsAsMember = await app.service('organizations').find({
            query: {
                'members.userId': user._id,
                $limit: 1
            } as any,
            provider: undefined
        })

        if (orgsAsMember.total > 0) {
            const existingOrg = orgsAsMember.data[0]
            logger.info('User already belongs to an organization, skipping default setup', {
                userId: user._id,
                orgId: existingOrg._id
            })

            // Update user with this organization as active
            const updatedUser = await app.service('users').patch(user._id, {
                activeOrganization: existingOrg._id,
                organizationId: existingOrg._id
            }, { provider: undefined })

            return updatedUser
        }
        // 1. Ensure default Admin role exists
        const rolesService = app.service('roles')
        const rolesResult = await rolesService.find({
            query: { name: 'Admin' },
            provider: undefined
        })

        let adminRole: any
        if (rolesResult.total === 0) {
            // @ts-ignore
            adminRole = await rolesService.create({
                name: 'Admin',
                permissions: ['*']
            }, { provider: undefined })
        } else {
            adminRole = rolesResult.data[0]
        }

        // 2. Create a default organization for the user. Consumers can override
        // the naming via `options.defaultOrgName`.
        const customNamer = (app.get('coreOptions') as any)?.defaultOrgName
        const defaultName = user.firstName
            ? `${user.firstName}'s Organization`
            : (user.email ? `${user.email.split('@')[0]}'s Organization` : 'My Organization')
        const orgName = typeof customNamer === 'function' ? customNamer(user) : defaultName
        const orgService = app.service('organizations')

        // @ts-ignore
        const organization = await orgService.create({
            name: orgName,
            members: [
                {
                    userId: user._id,
                    role: adminRole._id,
                    joinedAt: Date.now()
                }
            ]
        }, {
            provider: undefined,
            user: user // Pass user in params so setOwnerAndMember hook can set ownerId
        })

        // 3. Update the user with the new organization info.
        //
        // NOTE: we intentionally do NOT copy the org's Admin role onto
        // `user.role` here. `user.role` is the *site-level* role slot and is
        // what `isGlobalAdmin` reads — writing the org role into it would make
        // every self-signup user a global admin, which bypasses org
        // membership/permission checks and enables cross-tenant "Login As"
        // impersonation (see utils/access.ts and services/users/users.class.ts).
        // The user is already this org's admin via their membership
        // (`members[].role` above); own-org access flows through that. Grant a
        // genuine site admin by adding a role to `user.role` explicitly.
        const usersService = app.service('users')
        const updatedUser = await usersService.patch(user._id, {
            activeOrganization: organization._id,
            organizationId: organization._id
        }, { provider: undefined })

        return updatedUser

    } catch (error: any) {
        logger.error('Error in ensureUserHasOrganization: %O', error)
        return user
    }
}

/**
 * Hook to automatically create a default organization for new users.
 */
export const setupOrganization = () => {
    return async (context: HookContext) => {
        // Only run on creation result
        if (context.result) {
            context.result = await ensureUserHasOrganization(context.app, context.result)
        }
        return context
    }
}
