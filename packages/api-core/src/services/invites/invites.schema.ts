// For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve, virtual } from '@feathersjs/schema'
import { Type, getValidator, querySyntax } from '@feathersjs/typebox'
import { ObjectIdSchema } from '@feathersjs/typebox'
import type { Static } from '@feathersjs/typebox'

import type { HookContext, InvitesExtensions } from '../../declarations'
import { dataValidator, queryValidator } from '../../validators'
import type { InvitesService } from './invites.class'

// Define invite types
export enum InviteType {
  EMAIL = 'email',
  LINK = 'link'
}

// Define resource types
export enum ResourceType {
  ORGANIZATION = 'organization'
}

// Scopes are managed dynamically through the roles service
// No enum needed - use string array for flexibility

// Main data model schema
export const invitesSchema = Type.Object(
  {
    _id: ObjectIdSchema(),
    // Invite identification
    inviteType: Type.Enum(InviteType), // email, link
    resourceType: Type.Enum(ResourceType), // organization, team, project
    resourceId: ObjectIdSchema(), // ID of the resource being invited to

    // Invite details
    email: Type.Optional(Type.String({ format: 'email' })), // For email invites


    // Permissions and access
    scopes: Type.Array(Type.String()), // Array of roles/permissions (managed by roles service)

    // Virtual field for role names
    roleNames: Type.Optional(Type.Array(Type.Object({
      id: Type.String(),
      name: Type.String(),
      permissions: Type.Array(Type.String())
    }))),

    // Invite status and metadata
    status: Type.Optional(Type.String({ default: 'pending' })), // pending, accepted, declined, expired
    expiresAt: Type.Optional(Type.String({ format: 'date-time' })), // Optional expiration
    acceptedAt: Type.Optional(Type.String({ format: 'date-time' })),
    declinedAt: Type.Optional(Type.String({ format: 'date-time' })),

    // Audit fields
    userId: ObjectIdSchema(), // User who created the invite
    organizationId: ObjectIdSchema(), // Organization the invite is for
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' })
  },
  { $id: 'Invites', additionalProperties: false }
)
export type Invites = Static<typeof invitesSchema> & InvitesExtensions
export const invitesValidator = getValidator(invitesSchema, dataValidator)
export const invitesResolver = resolve<Invites, HookContext<InvitesService>>({
  roleNames: virtual(async (invite, context) => {
    try {
      // If no scopes, return empty array
      if (!invite.scopes || invite.scopes.length === 0) {
        return []
      }

      // Get role details for each scope
      const rolePromises = invite.scopes.map(async (scopeId: string) => {
        try {
          const role = await context.app.service('roles').get(scopeId)
          return {
            id: String(role._id),
            name: role.name,
            permissions: role.permissions
          }
        } catch (error) {
          // If role not found, return basic info
          return {
            id: String(scopeId),
            name: 'Unknown Role',
            permissions: []
          }
        }
      })

      return await Promise.all(rolePromises)
    } catch (error) {
      // If there's an error, return basic scope info
      return invite.scopes.map((scopeId: string) => ({
        id: String(scopeId),
        name: 'Unknown Role',
        permissions: []
      }))
    }
  })
})

export const invitesExternalResolver = resolve<Invites, HookContext<InvitesService>>({})

// Schema for creating new entries
export const invitesDataSchema = Type.Pick(
  invitesSchema,
  [
    'inviteType',
    'resourceType',
    'resourceId',
    'email',
    'scopes',
    'expiresAt',
    'userId',
    'organizationId',
    'status',
    'createdAt',
    'updatedAt'
  ],
  {
    $id: 'InvitesData'
  }
)
export type InvitesData = Static<typeof invitesDataSchema>
export const invitesDataValidator = getValidator(invitesDataSchema, dataValidator)
export const invitesDataResolver = resolve<Invites, HookContext<InvitesService>>({
  userId: async (value, invite, context) => {
    // Automatically set the userId to the authenticated user's ID
    return (context.params as any).user?._id
  },
  organizationId: async (value, invite, context) => {
    // Automatically set the organizationId to the user's active organization
    const user = (context.params as any).user
    return user?.activeOrganization || user?.organization
  },
  status: async () => {
    return 'pending'
  },

  createdAt: async () => {
    return new Date().toISOString()
  },
  updatedAt: async () => {
    return new Date().toISOString()
  }
})

// Schema for updating existing entries
export const invitesPatchSchema = Type.Partial(invitesSchema, {
  $id: 'InvitesPatch'
})
export type InvitesPatch = Static<typeof invitesPatchSchema>
export const invitesPatchValidator = getValidator(invitesPatchSchema, dataValidator)
export const invitesPatchResolver = resolve<Invites, HookContext<InvitesService>>({
  updatedAt: async () => {
    return new Date().toISOString()
  }
})

// Schema for allowed query properties
export const invitesQueryProperties = Type.Pick(invitesSchema, [
  '_id',
  'inviteType',
  'resourceType',
  'resourceId',
  'email',
  'userId',
  'status',
  'organizationId',
  'createdAt'
])
export const invitesQuerySchema = Type.Intersect(
  [
    querySyntax(invitesQueryProperties),
    // Add additional query properties here
    Type.Object({}, { additionalProperties: false })
  ],
  { additionalProperties: false }
)
export type InvitesQuery = Static<typeof invitesQuerySchema>
export const invitesQueryValidator = getValidator(invitesQuerySchema, queryValidator)
export const invitesQueryResolver = resolve<InvitesQuery, HookContext<InvitesService>>({})