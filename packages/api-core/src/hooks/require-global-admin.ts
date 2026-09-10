import { Forbidden } from '@feathersjs/errors'
import type { HookContext } from '../declarations'
import { isGlobalAdmin } from '../utils/access'

/**
 * Restrict a write method to global admins for external callers.
 *
 * Used on the `roles` service, whose documents are GLOBAL (shared across every
 * tenant). Without this, `accessControl: { mode: 'ignore' }` leaves create /
 * update / patch / remove open to any authenticated user — e.g. patching the
 * shared `Member` role to `permissions: ['*']` silently promotes every member
 * of every organization. Reads stay open (populate-user-roles and the org
 * permission checks need them); only writes are gated.
 *
 * Internal (server-side, `provider` undefined) calls are trusted — the package's
 * own flows (e.g. `ensureUserHasOrganization` seeding the Admin role) run that
 * way and must keep working.
 */
export const requireGlobalAdmin = () => {
  return async (context: HookContext) => {
    // Internal (server-side) calls are trusted.
    if (!context.params.provider) {
      return context
    }
    if (!isGlobalAdmin(context.params.user)) {
      throw new Forbidden('Only a global admin may modify roles')
    }
    return context
  }
}
