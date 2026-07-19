import { ObjectId } from 'mongodb'
import type { HookContext } from '../declarations'
import { logger } from '../logger'

/**
 * Expand a user's `role` array (ObjectIds) into full role objects for
 * downstream role checks (isGlobalAdmin, preventRoleChange, app code reading
 * `params.user.role`).
 *
 * Two correctness rules, both learned the hard way:
 *  1. Query with real ObjectIds. The query validator does NOT coerce strings to
 *     ObjectIds inside `$in`, so `_id: { $in: ['<hex>'] }` matches nothing.
 *  2. Fail open to the raw ids. On a lookup miss or error, leave `user.role`
 *     UNCHANGED — never replace it with `[]`, which would silently strip roles
 *     from a user who genuinely holds them and break every role check.
 */
export const populateUserRoles = () => {
    return async (context: HookContext) => {
        const { app, method, result } = context

        if (!result) return context

        const rolesService = app.service('roles')

        const populate = async (user: any) => {
            if (!user.role || !Array.isArray(user.role) || user.role.length === 0) {
                return user
            }

            // Already populated (objects with a name) — skip.
            if (typeof user.role[0] === 'object' && user.role[0] !== null && user.role[0].name) {
                return user
            }

            // Convert to real ObjectIds (see rule 1). Skip anything unparseable.
            const roleIds = user.role
                .map((r: any) => {
                    if (r instanceof ObjectId) return r
                    const s = String(r)
                    return ObjectId.isValid(s) ? new ObjectId(s) : null
                })
                .filter((r: ObjectId | null): r is ObjectId => r !== null)

            if (roleIds.length === 0) {
                // Nothing valid to look up — leave the raw ids untouched.
                return user
            }

            try {
                const found = await rolesService.find({
                    query: { _id: { $in: roleIds } },
                    paginate: false
                })
                const roles = Array.isArray(found) ? found : (found?.data ?? [])

                // Only replace when we actually resolved roles (see rule 2).
                if (roles.length > 0) {
                    user.role = roles
                }
            } catch (error) {
                logger.error('Error populating user roles: %O', error)
                // Leave user.role unchanged on error.
            }

            return user
        }

        if (method === 'find') {
            const data = result.data || result
            if (Array.isArray(data)) {
                await Promise.all(data.map((user: any) => populate(user)))
            }
        } else {
            context.result = await populate(result)
        }

        return context
    }
}
