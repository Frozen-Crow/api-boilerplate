import { hooks as schemaHooks } from '@feathersjs/schema'

import {
    serialIdsSchema,
    serialIdsDataValidator,
    serialIdsPatchValidator,
    serialIdsQueryValidator,
    serialIdsResolver,
    serialIdsExternalResolver,
    serialIdsDataResolver,
    serialIdsPatchResolver,
    serialIdsQueryResolver
} from './serial-ids.schema'

import type { Application } from '../../declarations'
import { SerialIds, getOptions } from './serial-ids.class'
import { serialIdsPath, serialIdsMethods } from './serial-ids.shared'

export * from './serial-ids.class'
export {
    serialIdsSchema,
    serialIdsDataValidator,
    serialIdsPatchValidator,
    serialIdsQueryValidator,
    serialIdsResolver,
    serialIdsExternalResolver,
    serialIdsDataResolver,
    serialIdsPatchResolver,
    serialIdsQueryResolver
} from './serial-ids.schema'
export { serialIdsPath, serialIdsMethods } from './serial-ids.shared'

export const serialIds = (app: Application) => {
    // Register our service on the Feathers application
    app.use(serialIdsPath, new SerialIds(getOptions(app), app), {
        // A list of all methods this service exposes externally
        methods: serialIdsMethods,
        // You can add additional custom events to be sent to clients here
        events: []
    })

    // Initialize hooks
    const standardHooks = [
        schemaHooks.resolveExternal(serialIdsExternalResolver),
        schemaHooks.resolveResult(serialIdsResolver)
    ]

    app.service(serialIdsPath).hooks({
        around: {
            find: standardHooks,
            get: standardHooks,
            create: standardHooks,
            patch: standardHooks,
            remove: standardHooks
        },
        before: {
            all: [
                schemaHooks.validateQuery(serialIdsQueryValidator),
                schemaHooks.resolveQuery(serialIdsQueryResolver)
            ],
            find: [],
            get: [],
            create: [
                schemaHooks.validateData(serialIdsDataValidator),
                schemaHooks.resolveData(serialIdsDataResolver)
            ],
            patch: [
                schemaHooks.validateData(serialIdsPatchValidator),
                schemaHooks.resolveData(serialIdsPatchResolver)
            ],
            remove: []
        },
        after: {
            all: []
        },
        error: {
            all: []
        }
    })

    // Create Index
    app.get('mongodbClient').then(db => {
        db.collection('serial-ids').createIndex(
            { organizationId: 1, type: 1, period: 1 },
            { unique: true }
        )
    })
}

declare module '../../declarations' {
    interface ServiceTypes {
        [serialIdsPath]: SerialIds
    }
}
