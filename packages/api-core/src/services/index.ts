import { user } from './users/users'
import { organizations } from './organizations/organizations'
import { roles } from './roles/roles'
import { serialIds } from './serial-ids/serial-ids'
import { invites } from './invites/invites'
import { verifications } from './verifications/verifications'
import type { Application } from '../declarations'

export type CoreServiceName =
  | 'users'
  | 'organizations'
  | 'roles'
  | 'serial-ids'
  | 'invites'
  | 'verifications'

const registry: Record<CoreServiceName, (app: Application) => void> = {
  users: user,
  organizations,
  roles,
  'serial-ids': serialIds,
  invites,
  verifications
}

export const ALL_CORE_SERVICES = Object.keys(registry) as CoreServiceName[]

/**
 * Returns a configure function that registers the built-in services. Pass a
 * subset of names to register only some of them; defaults to all.
 *
 * Note: several services depend on each other (users/organizations/roles are
 * the multitenant + RBAC backbone), so dropping those may break the rest.
 */
export const coreServices = (enabled: CoreServiceName[] = ALL_CORE_SERVICES) => {
  return (app: Application) => {
    for (const name of enabled) {
      const configure = registry[name]
      if (configure) {
        app.configure(configure)
      }
    }
  }
}

// Backwards-compatible: register every service.
export const services = coreServices()
