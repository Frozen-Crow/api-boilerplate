import type { Params } from '@feathersjs/feathers'
import type { ClientApplication } from '../../client'

import type { SerialIds, SerialIdsData, SerialIdsQuery, SerialIdsPatch } from './serial-ids.class'

export type { SerialIds, SerialIdsData, SerialIdsQuery, SerialIdsPatch }

export type SerialIdsClientService = Pick<
    SerialIds,
    (typeof serialIdsMethods)[number]
>

export const serialIdsPath = 'serial-ids'

export const serialIdsMethods = ['find', 'get', 'create', 'patch', 'remove', 'next'] as const

export const serialIdsClient = (client: ClientApplication) => {
    const connection = client.get('connection')

    client.use(serialIdsPath, connection.service(serialIdsPath), {
        methods: serialIdsMethods
    })
}

declare module '../../client' {
    interface ServiceTypes {
        [serialIdsPath]: SerialIdsClientService
    }
}
