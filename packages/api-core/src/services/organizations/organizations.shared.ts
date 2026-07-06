import type { OrganizationsData, OrganizationsPatch, OrganizationsQuery } from './organizations.schema'

export type { OrganizationsData, OrganizationsPatch, OrganizationsQuery }

export const organizationsPath = 'organizations'

export const organizationsMethods = ['find', 'get', 'create', 'patch', 'remove', 'invite', 'updateMemberRole', 'removeMember', 'getMembers'] as const

export const organizationsClient = (client: any) => {
    const connection = client.get('connection')

    client.use(organizationsPath, connection.service(organizationsPath), {
        methods: organizationsMethods
    })
}

declare module '../../declarations' {
    interface ServiceOptions {
        [organizationsPath]: {
            methods: typeof organizationsMethods
        }
    }
}
