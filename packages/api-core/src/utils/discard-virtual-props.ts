import type { HookContext, NextFunction } from '../declarations'

/**
 * Hook to discard virtual properties from external data (e.g. from client)
 * that should not be persisted to the database.
 * This checks the schema reducers/resolvers to identify virtual props.
 */
export const discardVirtualProps = (methods: string[], ...resolvers: any[]) => {
    return async (context: HookContext, next: NextFunction) => {
        if (context.data) {
            // Collect all virtual field names from all provided resolvers
            const virtualFields = new Set<string>()
            resolvers.forEach((resolver) => {
                if (resolver && Array.isArray(resolver.virtualNames)) {
                    resolver.virtualNames.forEach((name: string) => virtualFields.add(name))
                }
            })

            const discard = (data: any) => {
                virtualFields.forEach((field) => {
                    if (field in data) {
                        delete data[field]
                    }
                })
            }

            if (Array.isArray(context.data)) {
                context.data.forEach(discard)
            } else {
                discard(context.data)
            }
        }

        await next()
    }
}
