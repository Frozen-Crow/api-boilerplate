// For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from '@feathersjs/schema'
import { Type, getValidator, querySyntax } from '@feathersjs/typebox'
import { ObjectIdSchema } from '@feathersjs/typebox'
import type { Static } from '@feathersjs/typebox'
import { passwordHash } from '@feathersjs/authentication-local'

import type { HookContext, UserExtensions } from '../../declarations'
import { dataValidator, queryValidator } from '../../validators'
import type { UserService } from './users.class'

// Main data model schema
export const userSchema = Type.Object(
  {
    _id: ObjectIdSchema(),
    email: Type.String(),
    password: Type.Optional(Type.String()),
    firstName: Type.Optional(Type.String()),
    lastName: Type.Optional(Type.String()),
    activeOrganization: Type.Optional(ObjectIdSchema()),
    organizationId: Type.Optional(ObjectIdSchema()),
    role: Type.Optional(Type.Array(ObjectIdSchema())),
    googleId: Type.Optional(Type.String()),
    googleEmail: Type.Optional(Type.String()),
    emailVerified: Type.Optional(Type.Boolean()),
    profilePicture: Type.Optional(Type.String()),
    hostedDomain: Type.Optional(Type.String()),
    oauthVerified: Type.Optional(Type.Boolean()),
    createdAt: Type.Optional(Type.Integer()),
    updatedAt: Type.Optional(Type.Integer())
  },
  { $id: 'User', additionalProperties: false }
)
export type User = Static<typeof userSchema> & UserExtensions
export const userValidator = getValidator(userSchema, dataValidator)
export const userResolver = resolve<User, HookContext<UserService>>({})

export const userExternalResolver = resolve<User, HookContext<UserService>>({
  // The password should never be visible externally
  password: async () => undefined
})

// Schema for creating new entries
export const userDataSchema = Type.Pick(userSchema, ['email', 'password', 'firstName', 'lastName'], {
  $id: 'UserData'
})
export type UserData = Static<typeof userDataSchema>
export const userDataValidator = getValidator(userDataSchema, dataValidator)
export const userDataResolver = resolve<UserData, HookContext<UserService>>({
  password: passwordHash({ strategy: 'local' })
})

// Schema for updating existing entries
export const userPatchSchema = Type.Partial(Type.Pick(userSchema, [
  'email',
  'password',
  'firstName',
  'lastName',
  'activeOrganization',
  'organizationId',
  'role',
  'googleId',
  'googleEmail',
  'emailVerified',
  'profilePicture',
  'hostedDomain',
  'oauthVerified'
]), {
  $id: 'UserPatch'
})
export type UserPatch = Static<typeof userPatchSchema>
export const userPatchValidator = getValidator(userPatchSchema, dataValidator)
export const userPatchResolver = resolve<UserPatch, HookContext<UserService>>({
  password: passwordHash({ strategy: 'local' })
})

// Schema for allowed query properties
export const userQueryProperties = Type.Pick(userSchema, ['_id', 'email', 'firstName', 'lastName'])
export const userQuerySchema = Type.Intersect(
  [
    querySyntax(userQueryProperties),
    // Add additional query properties here
    Type.Object({}, { additionalProperties: false })
  ],
  { additionalProperties: false }
)
export type UserQuery = Static<typeof userQuerySchema>
export const userQueryValidator = getValidator(userQuerySchema, queryValidator)
export const userQueryResolver = resolve<UserQuery, HookContext<UserService>>({
  // If there is a user (e.g. with authentication), they are only allowed to see their own data
  // but only for external (REST/Socket.io) requests. Internal requests skip this restriction.
  _id: async (value, user, context) => {
    if (context.params.provider && context.params.user) {
      return context.params.user._id
    }

    return value
  }
})
