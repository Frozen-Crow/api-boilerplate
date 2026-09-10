import assert from 'assert'
import { MongoClient } from 'mongodb'
import { createApp } from '../src'

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/api-core-orgs-access-test'
const PORT = 9917
const url = `http://localhost:${PORT}`
const asJson = (r: Response) => r.json() as Promise<any>

// Issue #6: the membership boundary must apply to by-id methods, not just find.
describe('organizations service — by-id cross-tenant access control (issue #6)', () => {
  const app = createApp({
    mongodb: MONGO,
    authSecret: 'test-secret-at-least-32-characters-long!!',
    port: PORT,
    host: 'localhost',
    seed: true
  })

  const authHeaders = (t: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${t}` })

  // Create a user and authenticate — authentication provisions their own org
  // (as Admin of it) and sets activeOrganization.
  const makeUser = async (label: string) => {
    const creds = {
      email: `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@e.com`,
      password: 'supersecret'
    }
    await app.service('users').create(creds)
    const auth: any = await asJson(
      await fetch(`${url}/authentication`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: 'local', ...creds })
      })
    )
    assert.ok(auth.accessToken, `${label} authenticated`)
    assert.ok(auth.user?.activeOrganization, `${label} has an org`)
    return { token: auth.accessToken, user: auth.user }
  }

  let attacker: any
  let victim: any
  let victimOrgId = ''
  let attackerOrgId = ''

  before(async () => {
    await app.listen(PORT)
    attacker = await makeUser('attacker')
    victim = await makeUser('victim')
    attackerOrgId = String(attacker.user.activeOrganization)
    victimOrgId = String(victim.user.activeOrganization)
    assert.notStrictEqual(attackerOrgId, victimOrgId, 'two distinct orgs provisioned')
  })

  after(async () => {
    const client = await MongoClient.connect(MONGO)
    await client.db().dropDatabase()
    await client.close()
    await app.teardown()
  })

  it('lets a member read their own org by id', async () => {
    const res = await fetch(`${url}/organizations/${attackerOrgId}`, { headers: authHeaders(attacker.token) })
    assert.strictEqual(res.status, 200)
  })

  it('lets an org admin patch their own org', async () => {
    const res = await fetch(`${url}/organizations/${attackerOrgId}`, {
      method: 'PATCH',
      headers: authHeaders(attacker.token),
      body: JSON.stringify({ name: 'renamed-by-owner' })
    })
    assert.strictEqual(res.status, 200, 'owner/admin can patch own org')
  })

  it('forbids a non-member from READING another tenant org by id', async () => {
    const res = await fetch(`${url}/organizations/${victimOrgId}`, { headers: authHeaders(attacker.token) })
    assert.ok(res.status === 403 || res.status === 404, `expected 403/404, got ${res.status}`)
  })

  it('forbids a non-member from PATCHING another tenant org', async () => {
    const res = await fetch(`${url}/organizations/${victimOrgId}`, {
      method: 'PATCH',
      headers: authHeaders(attacker.token),
      body: JSON.stringify({ name: 'hacked' })
    })
    assert.ok(res.status === 403 || res.status === 404, `expected 403/404, got ${res.status}`)
    const org: any = await app.service('organizations').get(victimOrgId)
    assert.notStrictEqual(org.name, 'hacked', 'victim org not renamed')
  })

  it('forbids a non-member from DELETING another tenant org', async () => {
    const res = await fetch(`${url}/organizations/${victimOrgId}`, {
      method: 'DELETE',
      headers: authHeaders(attacker.token)
    })
    assert.ok(res.status === 403 || res.status === 404, `expected 403/404, got ${res.status}`)
    const org: any = await app.service('organizations').get(victimOrgId)
    assert.ok(org, 'victim org still exists')
  })
})
