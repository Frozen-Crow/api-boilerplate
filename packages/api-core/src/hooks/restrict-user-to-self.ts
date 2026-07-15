import { Forbidden } from '@feathersjs/errors'
import type { HookContext } from '../declarations'
import { isGlobalAdmin } from '../utils/access'

/**
 * Restrict by-id user operations (get / update / patch / remove) to the
 * caller's OWN record for external requests.
 *
 * The `restrictToUser` access-control mode does not actually scope these
 * operations (its `setField` target is ineffective, and the `_id` query
 * resolver only runs on `find`), so without this hook any authenticated user
 * could read, modify, or delete any other user by id. Internal calls
 * (`provider` undefined) and global admins are exempt so server-side flows and
 * admin management keep working.
 */
export const restrictUserToSelf = () => {
  return async (context: HookContext) => {
    const { params, id } = context

    // Internal (server-side) calls are trusted.
    if (!params.provider) {
      return context
    }

    const user = params.user
    // Unauthenticated requests are rejected upstream (restrictToUser mode).
    if (!user?._id) {
      return context
    }

    // Global admins may manage any user.
    if (isGlobalAdmin(user)) {
      return context
    }

    // A by-id operation must target the caller's own record.
    if (id != null && String(id) !== String(user._id)) {
      throw new Forbidden('You can only access your own user record')
    }

    // Belt-and-suspenders: also scope the query to the caller (covers any
    // multi-record variant reaching this method).
    context.params.query = { ...params.query, _id: user._id }

    return context
  }
}
