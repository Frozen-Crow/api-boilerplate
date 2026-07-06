import type { HookContext } from '../declarations'

// Key to store original data in context params
const ORIGINAL_DATA = Symbol('originalData')

export const storeOriginalRequestData = async (context: HookContext) => {
    if (context.data) {
        // Store a shallow copy of the original data in params
        (context.params as any)[ORIGINAL_DATA] = { ...context.data }
    }
    return context
}

export const removeInjectedDefaults = async (context: HookContext) => {
    const originalData = (context.params as any)[ORIGINAL_DATA]

    if (originalData && context.data) {
        // Iterate over current context.data (which might have defaults injected by validator)
        // If a key exists in context.data but NOT in originalData, it was likely injected as a default.
        // For PATCH requests, we usually want to remove these so we don't overwrite existing values with defaults.
        // (Unless the user explicitly sent undefined/null, but standard partial update usually implies only sent keys update)

        const internalFields = ['createdAt', 'updatedAt', 'organizationId', 'activeOrganization']

        Object.keys(context.data).forEach(key => {
            if (!(key in originalData) && !internalFields.includes(key)) {
                delete context.data[key]
            }
        })
    }

    return context
}
