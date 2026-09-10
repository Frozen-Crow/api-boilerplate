import assert from 'assert'
import { MongoClient } from 'mongodb'
import { createApp } from '../src'

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/api-core-roles-access-test'
const PORT = 9916
const url = `http://localhost:${PORT}`
const asJson = (r: Response) => r.json() as Promise<any>

// Issue #5: roles are global; write methods must be admin-only.
describe('roles service — write access control (issue #5)', () => {
  const app = createApp({
    mongodb: MONGO,
    authSecret: 'test-secret-at-least-32-characters-long!!',
    port: PORT,
    host: 'localhost',
    seed: true
  })

  const authHeaders = (token: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` })

  let userToken = ''
  let adminToken = ''
  let memberRoleId = ''

  before(async () => {
    await app.listen(PORT)

    // Ordinary self-registered user — no elevated (global) role.
    const creds = { email: `user-${Date.now()}@e.com`, password: 'supersecret' }
    await app.service('users').create(creds)
    userToken = (
      await asJson(
        await fetch(`${url}/authentication`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ strategy: 'local', ...creds })
        })
      )
    ).accessToken
    assert.ok(userToken, 'ordinary user authenticated')

    const adminRole: any = ((await app.service('roles').find({ query: { name: 'Admin' }, paginate: false } as any)) as any)[0]
    const memberRole: any = ((await app.service('roles').find({ query: { name: 'Member' }, paginate: false } as any)) as any)[0]
    assert.ok(adminRole && memberRole, 'seeded Admin/Member roles exist')
    memberRoleId = String(memberRole._id)

    // A genuine global admin: user whose *global* role is Admin.
    const adminCreds = { email: `admin-${Date.now()}@e.com`, password: 'supersecret' }
    const adminUser: any = await app.service('users').create(adminCreds)
    await app.service('users').patch(String(adminUser._id), { role: [adminRole._id] } as any) // internal, allowed
    adminToken = (
      await asJson(
        await fetch(`${url}/authentication`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ strategy: 'local', ...adminCreds })
        })
      )
    ).accessToken
    assert.ok(adminToken, 'admin authenticated')
  })

  after(async () => {
    const client = await MongoClient.connect(MONGO)
    await client.db().dropDatabase()
    await client.close()
    await app.teardown()
  })

  it('lets any authenticated user READ roles', async () => {
    const res = await fetch(`${url}/roles`, { headers: authHeaders(userToken) })
    assert.strictEqual(res.status, 200)
  })

  it('forbids a non-admin from create / patch / remove', async () => {
    const create = await fetch(`${url}/roles`, {
      method: 'POST',
      headers: authHeaders(userToken),
      body: JSON.stringify({ name: `x-${Date.now()}`, permissions: ['*'] })
    })
    assert.strictEqual(create.status, 403, 'create forbidden')

    const patch = await fetch(`${url}/roles/${memberRoleId}`, {
      method: 'PATCH',
      headers: authHeaders(userToken),
      body: JSON.stringify({ permissions: ['*'] })
    })
    assert.strictEqual(patch.status, 403, 'patch forbidden')

    const del = await fetch(`${url}/roles/${memberRoleId}`, { method: 'DELETE', headers: authHeaders(userToken) })
    assert.strictEqual(del.status, 403, 'remove forbidden')

    // The shared Member role must not have been escalated.
    const member: any = await app.service('roles').get(memberRoleId)
    assert.ok(!member.permissions.includes('*'), 'Member role not escalated to *')
  })

  it('allows a global admin to create a role', async () => {
    const res = await fetch(`${url}/roles`, {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: JSON.stringify({ name: `admin-made-${Date.now()}`, permissions: ['users:get'] })
    })
    assert.strictEqual(res.status, 201, 'global admin can create')
  })

  it('allows internal (server-side) role creation', async () => {
    const r: any = await app.service('roles').create({ name: `internal-${Date.now()}`, permissions: [] })
    assert.ok(r._id, 'internal create works')
  })
})
