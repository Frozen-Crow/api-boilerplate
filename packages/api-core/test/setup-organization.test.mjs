import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ensureUserHasOrganization } from '../lib/hooks/setup-organization.js'

// A minimal in-memory stand-in for the Feathers app: just the three services
// ensureUserHasOrganization touches, recording the calls we assert on. No Mongo.
function makeApp({ existingMemberOrgs = 0 } = {}) {
  const calls = { userPatch: [], orgCreate: [] }
  const adminRole = { _id: 'role-admin', name: 'Admin', permissions: ['*'] }
  const app = {
    get: () => undefined,
    service(name) {
      if (name === 'organizations') {
        return {
          find: async () => ({
            total: existingMemberOrgs,
            data: existingMemberOrgs ? [{ _id: 'org-existing' }] : []
          }),
          create: async (data) => {
            calls.orgCreate.push(data)
            return { _id: 'org-new', ...data }
          }
        }
      }
      if (name === 'roles') {
        return { find: async () => ({ total: 1, data: [adminRole] }) }
      }
      if (name === 'users') {
        return {
          patch: async (id, data) => {
            calls.userPatch.push({ id, data })
            return { _id: id, ...data }
          }
        }
      }
      throw new Error(`unexpected service: ${name}`)
    }
  }
  return { app, calls, adminRole }
}

test('new self-signup user is org admin via membership but NOT a site-level admin', async () => {
  const { app, calls, adminRole } = makeApp({ existingMemberOrgs: 0 })

  const result = await ensureUserHasOrganization(app, { _id: 'u1', email: 'a@b.com' })

  // Org-level admin is preserved: the user is created as a member with the Admin role.
  assert.equal(calls.orgCreate.length, 1)
  assert.equal(String(calls.orgCreate[0].members[0].role), String(adminRole._id))

  // The crux of the fix: the user patch must NOT set the site-level `role`
  // slot (that is what isGlobalAdmin reads). Auto-granting it there made every
  // signup a global admin — cross-tenant access + "Login As" impersonation.
  assert.equal(calls.userPatch.length, 1)
  assert.ok(!('role' in calls.userPatch[0].data), 'user.role must not be auto-granted at signup')
  assert.ok(!('role' in result), 'returned user must not carry an auto-granted site role')
})

test('invited user (already a member) is also not auto-granted a site role', async () => {
  const { app, calls } = makeApp({ existingMemberOrgs: 1 })

  await ensureUserHasOrganization(app, { _id: 'u2', email: 'c@d.com' })

  assert.equal(calls.userPatch.length, 1)
  assert.ok(!('role' in calls.userPatch[0].data), 'user.role must not be set for invited users')
})
