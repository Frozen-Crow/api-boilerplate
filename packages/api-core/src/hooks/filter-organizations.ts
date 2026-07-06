import type { HookContext } from '../declarations'
import { isGlobalAdmin } from '../utils/access'

/**
 * Hook that filters organizations to only those where the user is a member.
 * This should be used on the 'organizations' service 'find' method.
 */
export const filterOrganizationsByMembership = () => {
    return async (context: HookContext) => {
        const { params: { user } } = context

        if (!user) {
            return context
        }

        // Global admins can see everything
        const isAdmin = isGlobalAdmin(user)

        if (isAdmin) {
            // Check if specifically requesting all organizations (Admin Dashboard)
            if (context.params.query?.$adminAll) {
                // Remove the flag so it doesn't go to DB
                delete context.params.query.$adminAll
                return context
            }
        }

        // Filter organizations where members array contains an object with this userId
        // Note: MongoDB requires ObjectId type match, not string
        context.params.query = {
            ...context.params.query,
            'members.userId': user._id // Use ObjectId directly, not string
        }

        return context
    }
}
