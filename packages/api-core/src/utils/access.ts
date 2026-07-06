import { NotAuthenticated, Forbidden } from '@feathersjs/errors'
import type { Application } from '../declarations'

/**
 * Shared access-control helpers.
 *
 * These are the single source of truth for "is this user a global admin" and
 * "is this user allowed to act on this organization". Keeping the logic in one
 * place avoids the subtle drift that previously existed between hooks (some
 * compared `role.name`, some compared `role.toString()` against a hard-coded
 * ObjectId, which never matched once roles were populated into objects).
 */

/**
 * Returns true if the user carries a global "Admin" role.
 *
 * By the time access control runs, `populate-user-roles` has expanded
 * `user.role` from an array of ObjectIds into an array of role objects
 * ({ name, permissions }). We therefore match on the role *name*
 * (case-insensitive) rather than on stringified ObjectIds.
 */
export const isGlobalAdmin = (user: any): boolean =>
  Array.isArray(user?.role) &&
  user.role.some(
    (r: any) => typeof r === 'object' && r?.name && String(r.name).toLowerCase() === 'admin'
  )

/**
 * Fetch an organization membership record for a user, bypassing provider-level
 * access control (internal call). Returns the member entry or null.
 */
const getMembership = async (app: Application, organizationId: any, userId: any) => {
  const org = (await app.service('organizations').get(organizationId, {
    provider: undefined,
    authentication: undefined,
    user: undefined
  } as any)) as any

  const member = org?.members?.find((m: any) => String(m.userId) === String(userId)) || null
  return { org, member }
}

/**
 * Assert that `user` is a member of `organizationId`. Global admins always pass.
 * Throws NotAuthenticated / Forbidden otherwise.
 */
export const assertOrgMembership = async (app: Application, user: any, organizationId: any) => {
  if (!user?._id) {
    throw new NotAuthenticated('Authentication required')
  }
  if (isGlobalAdmin(user)) {
    return
  }
  if (!organizationId) {
    throw new Forbidden('No organization specified')
  }
  const { member } = await getMembership(app, organizationId, user._id)
  if (!member) {
    throw new Forbidden('You are not a member of this organization')
  }
}

/**
 * Assert that `user` holds `permission` (e.g. "organizations:patch") within
 * `organizationId` via their organization role. Global admins always pass.
 * Supports wildcard grants: "*", "<path>:*".
 */
export const assertOrgPermission = async (
  app: Application,
  user: any,
  organizationId: any,
  permission: string
) => {
  if (!user?._id) {
    throw new NotAuthenticated('Authentication required')
  }
  if (isGlobalAdmin(user)) {
    return
  }
  if (!organizationId) {
    throw new Forbidden('No organization specified')
  }

  const { member } = await getMembership(app, organizationId, user._id)
  if (!member) {
    throw new Forbidden('You are not a member of this organization')
  }

  const role = (await app.service('roles').get(String(member.role), {
    provider: undefined,
    authentication: undefined,
    user: undefined
  } as any)) as any

  const permissions: string[] = role?.permissions || []
  const [path] = permission.split(':')
  const allowed =
    permissions.includes('*') ||
    permissions.includes(`${path}:*`) ||
    permissions.includes(permission)

  if (!allowed) {
    throw new Forbidden(`Missing required permission: ${permission}`)
  }
}
