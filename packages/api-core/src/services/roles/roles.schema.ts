import { resolve } from '@feathersjs/schema'
import { Type, getValidator, querySyntax } from '@feathersjs/typebox'
import { ObjectIdSchema } from '@feathersjs/typebox'
import type { Static } from '@feathersjs/typebox'

import type { HookContext } from '../../declarations'
import { dataValidator, queryValidator } from '../../validators'
import type { Roles } from './roles.class'

// Main data model schema
export const rolesSchema = Type.Object(
    {
        _id: ObjectIdSchema(),
        name: Type.String(),
        permissions: Type.Array(Type.String()),
        createdAt: Type.Number(),
        updatedAt: Type.Number()
    },
    { $id: 'Roles', additionalProperties: false }
)
export type RolesData = Static<typeof rolesSchema>
export const rolesValidator = getValidator(rolesSchema, dataValidator)
export const rolesResolver = resolve<RolesData, HookContext<Roles>>({})

export const rolesExternalResolver = resolve<RolesData, HookContext<Roles>>({})

// Schema for creating new entries
export const rolesDataSchema = Type.Intersect([
    Type.Pick(rolesSchema, ['name', 'permissions']),
    Type.Object({
        createdAt: Type.Optional(Type.Number()),
        updatedAt: Type.Optional(Type.Number())
    })
], {
    $id: 'RolesData'
})
export type RolesNewData = Static<typeof rolesDataSchema>
export const rolesDataValidator = getValidator(rolesDataSchema, dataValidator)
export const rolesDataResolver = resolve<RolesNewData, HookContext<Roles>>({
    createdAt: async () => Date.now(),
    updatedAt: async () => Date.now()
})

// Schema for updating existing entries
export const rolesPatchSchema = Type.Partial(rolesSchema, {
    $id: 'RolesPatch'
})
export type RolesPatch = Static<typeof rolesPatchSchema>
export const rolesPatchValidator = getValidator(rolesPatchSchema, dataValidator)
export const rolesPatchResolver = resolve<RolesPatch, HookContext<Roles>>({
    updatedAt: async () => Date.now()
})

// Schema for allowed query properties
export const rolesQueryProperties = Type.Pick(rolesSchema, ['_id', 'name', 'createdAt', 'updatedAt'])
export const rolesQuerySchema = Type.Intersect(
    [
        querySyntax(rolesQueryProperties),
        // Add additional query properties here
        Type.Object({
            organizationId: Type.Optional(Type.String())
        }, { additionalProperties: false })
    ],
    { additionalProperties: false }
)
export type RolesQuery = Static<typeof rolesQuerySchema>
export const rolesQueryValidator = getValidator(rolesQuerySchema, queryValidator)
export const rolesQueryResolver = resolve<RolesQuery, HookContext<Roles>>({})
