import type { RolesData, RolesPatch, RolesQuery } from './roles.schema'

export type { RolesData, RolesPatch, RolesQuery }

export const rolesPath = 'roles'

export const rolesMethods = ['find', 'get', 'create', 'patch', 'remove'] as const

export const rolesClient = (client: any) => {
    const connection = client.get('connection')

    client.use(rolesPath, connection.service(rolesPath), {
        methods: rolesMethods
    })
}

declare module '../../declarations' {
    interface ServiceOptions {
        [rolesPath]: {
            methods: typeof rolesMethods
        }
    }
}
