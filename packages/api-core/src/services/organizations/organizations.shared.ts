// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { Params } from '@feathersjs/feathers'
import type { ClientApplication } from '../../client'
import type { Organizations } from './organizations.class'
import type { OrganizationsData, OrganizationsPatch, OrganizationsQuery } from './organizations.schema'

export type { OrganizationsData, OrganizationsPatch, OrganizationsQuery }

export const organizationsPath = 'organizations'

export const organizationsMethods = ['find', 'get', 'create', 'patch', 'remove', 'invite', 'updateMemberRole', 'removeMember', 'getMembers'] as const

// Includes the custom methods (invite, updateMemberRole, removeMember, getMembers).
export type OrganizationsClientService = Pick<
    Organizations<Params<OrganizationsQuery>>,
    (typeof organizationsMethods)[number]
>

export const organizationsClient = (client: ClientApplication) => {
    const connection = client.get('connection')

    client.use(organizationsPath, connection.service(organizationsPath), {
        methods: [...organizationsMethods]
    })
}

// Add this service to the client service type index
declare module '../../client' {
    interface ServiceTypes {
        [organizationsPath]: OrganizationsClientService
    }
}
