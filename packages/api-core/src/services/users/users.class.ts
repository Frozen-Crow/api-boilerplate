// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#database-services
import type { Params } from '@feathersjs/feathers'
import { MongoDBService } from '@feathersjs/mongodb'
import type { MongoDBAdapterParams, MongoDBAdapterOptions } from '@feathersjs/mongodb'
import { NotAuthenticated, Forbidden } from '@feathersjs/errors'

import type { Application } from '../../declarations'
import { isGlobalAdmin } from '../../utils/access'
import type { User, UserData, UserPatch, UserQuery } from './users.schema'

export type { User, UserData, UserPatch, UserQuery }

export interface UserParams extends MongoDBAdapterParams<UserQuery> { }

// By default calls the standard MongoDB adapter service methods but can be customized with your own functionality.
export class UserService<ServiceParams extends Params = UserParams> extends MongoDBService<
  User,
  UserData,
  UserParams,
  UserPatch
> {
  app: Application

  constructor(options: MongoDBAdapterOptions, app: Application) {
    super(options)
    this.app = app
  }

  async impersonate(data: { userId?: string, organizationId?: string }, params?: ServiceParams) {
    // Authorization: this method mints a JWT, so it must never be reachable
    // anonymously. Global admins may impersonate anyone into any organization
    // ("Login As"). Everyone else may only refresh a token for THEMSELVES, and
    // only into an organization they actually belong to (org switching).
    const caller = params?.user
    if (!caller?._id) {
      throw new NotAuthenticated('Authentication required')
    }

    const callerIsAdmin = isGlobalAdmin(caller)

    if (!callerIsAdmin) {
      if (data.userId && String(data.userId) !== String(caller._id)) {
        throw new Forbidden('You may only refresh your own session')
      }
      // Force the impersonation target to the caller.
      data = { ...data, userId: String(caller._id) }

      if (data.organizationId) {
        const org = (await this.app.service('organizations').get(data.organizationId, {
          provider: undefined
        } as any)) as any
        const isMember = org?.members?.some(
          (m: any) => String(m.userId) === String(caller._id)
        )
        if (!isMember) {
          throw new Forbidden('You are not a member of that organization')
        }
      }
    }

    let userId = data.userId || caller._id

    // If organization is specified but we are just the global admin (no specific userId target),
    // we want to "become" the admin of that organization to see their view.
    if (callerIsAdmin && data.organizationId && (!data.userId || String(data.userId) === String(caller._id))) {
      // If the request explicitly asks to impersonate oneself (userId == current user), 
      // AND we are the global admin, we might typically just want a token for this context (Refresh case).
      // BUT, if the user clicked "Login As" from the dashboard, they usually passed JUST organizationId.

      // Let's refine: 
      // 1. If userId IS provided and matches 'data.userId', we use it. (Refresh Flow)
      // 2. If userId is NOT provided in data, we default to finding the Org Admin. (Login As Flow)

      if (!data.userId) {
        try {
          const org = await this.app.service('organizations').get(data.organizationId) as any
          if (org && org.members && org.members.length > 0) {
            // Find the Admin role to identify the main user
            const adminRole = await this.app.service('roles').find({
              query: { name: 'Admin', $limit: 1 },
              paginate: false
            }) as any

            let targetMember = null

            if (adminRole && adminRole.length > 0) {
              targetMember = org.members.find((m: any) => String(m.role) === String(adminRole[0]._id))
            }

            // Fallback to first member if no explicit admin found
            if (!targetMember) {
              targetMember = org.members[0]
            }

            if (targetMember) {
              userId = targetMember.userId
            }
          }
        } catch (error) {
          console.error('Failed to find organization admin for impersonation', error)
          // Fallback to current user if lookups fail
        }
      }
    }

    if (!userId) {
      throw new Error('UserId is required for impersonation')
    }

    // Create a new JWT for this user + organization
    const authService = this.app.service('authentication')

    // We pass the user and the desired activeOrganization to createAccessToken
    // The authentication service will then create a JWT with these as payload
    const accessToken = await authService.createAccessToken({
      sub: String(userId),
      activeOrganization: data.organizationId
    })

    return { accessToken }
  }
}

export const getOptions = (app: Application): MongoDBAdapterOptions => {
  return {
    paginate: app.get('paginate'),
    Model: app.get('mongodbClient').then(db => db.collection('users'))
  }
}
