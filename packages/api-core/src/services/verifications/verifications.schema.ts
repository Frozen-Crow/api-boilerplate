// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from '@feathersjs/schema'
import { Type, getValidator, querySyntax } from '@feathersjs/typebox'
import { ObjectIdSchema } from '@feathersjs/typebox'
import type { Static } from '@feathersjs/typebox'

import type { HookContext, VerificationsExtensions } from '../../declarations'
import { dataValidator, queryValidator } from '../../validators'
import type { VerificationsService } from './verifications.class'

// Verification types
export const verificationTypeSchema = Type.Union([
  Type.Literal('magic-link'),
  Type.Literal('password-reset'),
  Type.Literal('invite')
])

// Main data model schema
export const verificationsSchema = Type.Object(
  {
    _id: ObjectIdSchema(),
    type: verificationTypeSchema,
    token: Type.String(), // Secure token/code for verification
    email: Type.String(), // Email address for the verification
    userId: Type.Optional(ObjectIdSchema()), // Optional user ID if user exists
    expiresAt: Type.Number(), // Unix timestamp when verification expires
    used: Type.Boolean(), // Whether the verification has been used
    usedAt: Type.Optional(Type.Number()), // Unix timestamp when verification was used
    metadata: Type.Optional(Type.Record(Type.String(), Type.Any())), // Additional data (e.g., organizationId, role, etc.)
    createdAt: Type.Optional(Type.Number()), // Unix timestamp when created
    updatedAt: Type.Optional(Type.Number()) // Unix timestamp when updated
  },
  { $id: 'Verifications', additionalProperties: false }
)
export type Verifications = Static<typeof verificationsSchema> & VerificationsExtensions
export const verificationsValidator = getValidator(verificationsSchema, dataValidator)
export const verificationsResolver = resolve<Verifications, HookContext<VerificationsService>>({})

export const verificationsExternalResolver = resolve<Verifications, HookContext<VerificationsService>>({
  // Never expose the raw token in external responses. (This must be a flat
  // property resolver — nesting it under `properties` silently does nothing,
  // which previously leaked every verification token over the API.)
  token: async () => undefined
})

// Schema for creating new entries
export const verificationsDataSchema = Type.Object({
  type: verificationTypeSchema,
  email: Type.String(),
  userId: Type.Optional(ObjectIdSchema()),
  expiresIn: Type.Optional(Type.Number()), // Expiration time in milliseconds (defaults to 1 hour)
  metadata: Type.Optional(Type.Record(Type.String(), Type.Any()))
}, {
  $id: 'VerificationsData'
})
export type VerificationsData = Static<typeof verificationsDataSchema>
export const verificationsDataValidator = getValidator(verificationsDataSchema, dataValidator)
export const verificationsDataResolver = resolve<Verifications, HookContext<VerificationsService>>({})

// Schema for updating existing entries
export const verificationsPatchSchema = Type.Partial(verificationsSchema, {
  $id: 'VerificationsPatch'
})
export type VerificationsPatch = Static<typeof verificationsPatchSchema>
export const verificationsPatchValidator = getValidator(verificationsPatchSchema, dataValidator)
export const verificationsPatchResolver = resolve<Verifications, HookContext<VerificationsService>>({})

// Schema for allowed query properties
export const verificationsQueryProperties = Type.Pick(verificationsSchema, ['_id', 'type', 'email', 'userId', 'used', 'token'])
export const verificationsQuerySchema = Type.Intersect(
  [
    querySyntax(verificationsQueryProperties),
    // Add additional query properties here
    Type.Object({}, { additionalProperties: false })
  ],
  { additionalProperties: false }
)
export type VerificationsQuery = Static<typeof verificationsQuerySchema>
export const verificationsQueryValidator = getValidator(verificationsQuerySchema, queryValidator)
export const verificationsQueryResolver = resolve<VerificationsQuery, HookContext<VerificationsService>>({})
