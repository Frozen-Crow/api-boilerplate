import type { HookContext } from '../declarations'

export const populateUserRoles = () => {
    return async (context: HookContext) => {
        const { app, method, result, params } = context

        // Skip if no result or if internal call already has roles
        if (!result) return context

        const rolesService = app.service('roles')

        const populate = async (user: any) => {
            if (!user.role || !Array.isArray(user.role) || user.role.length === 0) {
                return user
            }

            // If already populated (objects with name), skip
            if (typeof user.role[0] === 'object' && user.role[0].name) {
                return user
            }

            const roleIds = user.role.map((r: any) => r.toString())

            try {
                const roles = await rolesService.find({
                    query: {
                        _id: { $in: roleIds }
                    },
                    paginate: false
                })

                user.role = Array.isArray(roles) ? roles : (roles.data || [])
            } catch (error) {
                console.error('Error populating user roles:', error)
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
