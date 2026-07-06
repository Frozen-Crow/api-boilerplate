import type { HookContext } from '../declarations'
import { isGlobalAdmin } from '../utils/access'

/**
 * Fields on the user record that control identity or authorization and must
 * never be self-assigned by a normal user through the public API. Without this
 * guard a user could `PATCH /users/<self>` with `{ role: [<AdminRoleId>] }` and
 * escalate to a global admin (roles are world-readable), or flip
 * `emailVerified` / `oauthVerified` to bypass verification gating.
 */
const PROTECTED_FIELDS = [
    'role',
    'emailVerified',
    'oauthVerified',
    'googleId',
    'googleEmail',
    'hostedDomain'
]

/**
 * Strip privileged fields from user create/update/patch data for external
 * requests made by non-admins. Internal calls (provider undefined) and global
 * admins are trusted and pass through unchanged.
 */
export const preventRoleChange = () => {
    return async (context: HookContext) => {
        const { data, params } = context

        if (!data) {
            return context
        }

        // Internal (server-side) calls are trusted.
        if (!params.provider) {
            return context
        }

        // Global admins may manage these fields.
        if (params.user && isGlobalAdmin(params.user)) {
            return context
        }

        const strip = (obj: any) => {
            PROTECTED_FIELDS.forEach((field) => {
                if (field in obj) {
                    delete obj[field]
                }
            })
        }

        if (Array.isArray(data)) {
            data.forEach(strip)
        } else {
            strip(data)
        }

        return context
    }
}
