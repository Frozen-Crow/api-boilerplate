import { ObjectId } from 'mongodb'
import type { HookContext } from '../declarations'
import { logger } from '../logger'

/**
 * Filter users based on organization membership.
 * Ensures a user can only find other users within their own organization.
 */
export const filterUsersByOrganization = () => {
    return async (context: HookContext) => {
        const { user } = context.params

        // Skip if internal or no user (e.g. public routes, which shouldn't happen for users:find)
        if (!context.params.provider || !user) {
            return context
        }

        // Get organizationId from query (sent by client) or from user profile
        const organizationId = context.params.query?.organizationId || user.activeOrganization || user.organizationId

        if (!organizationId) {
            return context
        }

        try {
            // Fetch the organization to get the member list
            const org = await context.app.service('organizations').get(organizationId, { provider: undefined })

            // Verify the requester is actually a member
            const requesterIsMember = org.members.some((m: any) => String(m.userId) === String(user._id))

            if (!requesterIsMember) {
                logger.warn('[filterUsersByOrganization] User attempted to access users for organization they dont belong to', {
                    userId: user._id,
                    orgId: organizationId
                })
                return context
            }

            // Convert member userIds to ObjectIds for correct MongoDB querying
            const memberIds = org.members.map((m: any) => new ObjectId(m.userId))

            // Limit the query to only these members
            context.params.query = {
                ...context.params.query,
                _id: { $in: memberIds }
            }

            // Remove organizationId from the query to ensure we only filter by the verified member list
            delete context.params.query.organizationId

            return context
        } catch (err: any) {
            logger.error('[filterUsersByOrganization] Error: %O', err)
            return context
        }
    }
}
