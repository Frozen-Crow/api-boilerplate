import type { HookContext } from '../declarations'
import { assertOrgMembership, assertOrgPermission } from '../utils/access'

/**
 * Assert the caller is a member of the organization being acted on *by id*.
 *
 * `filterOrganizationsByMembership` only scopes the `find` list; the by-id
 * methods (get/patch/remove) otherwise reach any organization by id, which is a
 * cross-tenant boundary break. These hooks close that by checking the TARGET
 * org (`context.id`) — `teamAccessControl` only verifies the caller's *own*
 * active org, so an Admin of org A would otherwise pass for org B.
 *
 * Global admins short-circuit inside the assert helpers. Internal (server-side,
 * `provider` undefined) calls are trusted and skipped.
 */
export const assertOrgMembershipHook = () => {
  return async (context: HookContext) => {
    if (!context.params.provider) {
      return context
    }
    await assertOrgMembership(context.app, context.params.user, context.id)
    return context
  }
}

/**
 * Like `assertOrgMembershipHook`, but requires a specific permission (e.g.
 * `organizations:patch`) on the target org — so an ordinary member cannot
 * rename or delete the org they belong to unless their role grants it.
 */
export const assertOrgPermissionHook = (permission: string) => {
  return async (context: HookContext) => {
    if (!context.params.provider) {
      return context
    }
    await assertOrgPermission(context.app, context.params.user, context.id, permission)
    return context
  }
}
