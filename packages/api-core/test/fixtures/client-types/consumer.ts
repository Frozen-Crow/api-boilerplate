// Type-level fixture for issue #12, compiled by test/client-types.test.ts.
// Wrapped in a function so mocha loading it (it picks up every .ts under test/)
// never executes anything.
import { createClient } from '../../../src/client'

export function typedClientUsage(connection: any) {
  const client = createClient(connection)

  client.service('users').find()
  client.service('organizations').find()
  client.service('roles').find()

  // Custom organizations methods are typed on the client.
  client.service('organizations').getMembers({ organizationId: 'org' })
  client.service('organizations').invite({ roleId: 'role', organizationId: 'org', email: 'a@example.com' })

  // @ts-expect-error -- roles doesn't expose `update` to clients
  client.service('roles').update
}
