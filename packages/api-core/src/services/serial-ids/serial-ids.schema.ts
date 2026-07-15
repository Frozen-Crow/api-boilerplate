import { resolve } from '@feathersjs/schema'
import { Type, getValidator, querySyntax } from '@feathersjs/typebox'
import { ObjectIdSchema } from '@feathersjs/typebox'
import type { Static } from '@feathersjs/typebox'
import { ObjectId } from 'mongodb'

import type { HookContext, SerialIdsExtensions } from '../../declarations'
import { dataValidator, queryValidator } from '../../validators'

// Main data model schema
export const serialIdsSchema = Type.Object(
    {
        _id: ObjectIdSchema(),
        organizationId: ObjectIdSchema(),
        type: Type.String(),
        period: Type.String(),
        seq: Type.Number(),
        createdAt: Type.Number(),
        updatedAt: Type.Number()
    },
    { $id: 'SerialIds', additionalProperties: false }
)
export type SerialIdsData = Static<typeof serialIdsSchema> & SerialIdsExtensions
export const serialIdsValidator = getValidator(serialIdsSchema, dataValidator)
export const serialIdsResolver = resolve<SerialIdsData, HookContext>({})

export const serialIdsExternalResolver = resolve<SerialIdsData, HookContext>({})

// Schema for creating new entries
export const serialIdsDataSchema = Type.Intersect([
    Type.Pick(serialIdsSchema, ['organizationId', 'type', 'period', 'seq']),
    Type.Object({
        createdAt: Type.Optional(Type.Number()),
        updatedAt: Type.Optional(Type.Number())
    })
], {
    $id: 'SerialIdsData'
})
export type SerialIdsNewData = Static<typeof serialIdsDataSchema>
export const serialIdsDataValidator = getValidator(serialIdsDataSchema, dataValidator)
export const serialIdsDataResolver = resolve<SerialIdsNewData, HookContext>({
    createdAt: async () => Date.now(),
    updatedAt: async () => Date.now()
})

// Schema for updating existing entries
export const serialIdsPatchSchema = Type.Partial(serialIdsSchema, {
    $id: 'SerialIdsPatch'
})
export type SerialIdsPatch = Static<typeof serialIdsPatchSchema>
export const serialIdsPatchValidator = getValidator(serialIdsPatchSchema, dataValidator)
export const serialIdsPatchResolver = resolve<SerialIdsPatch, HookContext>({
    updatedAt: async () => Date.now()
})

// Schema for allowed query properties
export const serialIdsQueryProperties = Type.Pick(serialIdsSchema, [
    '_id',
    'organizationId',
    'type',
    'period',
    'seq',
    'createdAt',
    'updatedAt'
])
export const serialIdsQuerySchema = Type.Intersect(
    [
        querySyntax(serialIdsQueryProperties),
        // Add additional query properties here
        Type.Object({}, { additionalProperties: false })
    ],
    { additionalProperties: false }
)
export type SerialIdsQuery = Static<typeof serialIdsQuerySchema>
export const serialIdsQueryValidator = getValidator(serialIdsQuerySchema, queryValidator)
export const serialIdsQueryResolver = resolve<any, HookContext>({
    organizationId: async (value) => (typeof value === 'string' && value.length === 24) ? new ObjectId(value) : value
})
