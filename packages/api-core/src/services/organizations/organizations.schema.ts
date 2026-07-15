import { resolve } from '@feathersjs/schema'
import { Type, getValidator, querySyntax } from '@feathersjs/typebox'
import { ObjectIdSchema } from '@feathersjs/typebox'
import type { Static } from '@feathersjs/typebox'

import type { HookContext, OrganizationsExtensions } from '../../declarations'
import { dataValidator, queryValidator } from '../../validators'
import type { Organizations } from './organizations.class'

// Sub-schemas
const memberSchema = Type.Object({
    userId: ObjectIdSchema(),
    role: ObjectIdSchema(),
    joinedAt: Type.Number()
})

// Main data model schema
export const organizationsSchema = Type.Object(
    {
        _id: ObjectIdSchema(),
        name: Type.String(),
        address: Type.Optional(Type.String()),
        city: Type.Optional(Type.String()),
        state: Type.Optional(Type.String()),
        zip: Type.Optional(Type.String()),
        phone: Type.Optional(Type.String()),
        email: Type.Optional(Type.String()),
        ownerId: Type.Optional(ObjectIdSchema()),
        onboarded: Type.Boolean({ default: false }),
        members: Type.Array(memberSchema),
        createdAt: Type.Number(),
        updatedAt: Type.Number()
    },
    { $id: 'Organizations', additionalProperties: false }
)
export type OrganizationsData = Static<typeof organizationsSchema> & OrganizationsExtensions
export const organizationsValidator = getValidator(organizationsSchema, dataValidator)
export const organizationsResolver = resolve<OrganizationsData, HookContext<Organizations>>({})

export const organizationsExternalResolver = resolve<OrganizationsData, HookContext<Organizations>>({})

// Schema for creating new entries
export const organizationsDataSchema = Type.Intersect([
    Type.Pick(organizationsSchema, ['name']) as any,
    Type.Object({
        members: Type.Optional(Type.Array(memberSchema)),
        ownerId: Type.Optional(ObjectIdSchema()),
        createdAt: Type.Optional(Type.Number()),
        updatedAt: Type.Optional(Type.Number())
    })
], {
    $id: 'OrganizationsData'
})
export type OrganizationsNewData = Static<typeof organizationsDataSchema>
export const organizationsDataValidator = getValidator(organizationsDataSchema, dataValidator)
export const organizationsDataResolver = resolve<OrganizationsNewData, HookContext<Organizations>>({
    createdAt: async () => Date.now(),
    updatedAt: async () => Date.now(),
    members: async (value: any) => value || []
})

// Schema for updating existing entries
export const organizationsPatchSchema = Type.Partial(organizationsSchema, {
    $id: 'OrganizationsPatch'
})
export type OrganizationsPatch = Static<typeof organizationsPatchSchema>
export const organizationsPatchValidator = getValidator(organizationsPatchSchema, dataValidator)
export const organizationsPatchResolver = resolve<OrganizationsPatch, HookContext<Organizations>>({
    updatedAt: async () => Date.now()
})

// Schema for allowed query properties
export const organizationsQueryProperties = Type.Pick(organizationsSchema, [
    '_id',
    'name',
    'address',
    'city',
    'state',
    'zip',
    'phone',
    'email',
    'ownerId',
    'createdAt',
    'updatedAt',
    'onboarded'
]) as any
export const organizationsQuerySchema = Type.Intersect(
    [
        querySyntax(organizationsQueryProperties),
        // Add additional query properties here
        Type.Object({
            'members.userId': Type.Optional(Type.Any()),
            '$adminAll': Type.Optional(Type.Boolean())
        }, { additionalProperties: false })
    ],
    { additionalProperties: false }
)
export type OrganizationsQuery = Static<typeof organizationsQuerySchema>
export const organizationsQueryValidator = getValidator(organizationsQuerySchema, queryValidator)
export const organizationsQueryResolver = resolve<OrganizationsQuery, HookContext<Organizations>>({})
