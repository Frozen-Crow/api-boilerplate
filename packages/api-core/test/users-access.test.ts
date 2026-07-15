import assert from 'assert'
import { MongoClient } from 'mongodb'
import { createApp } from '../src'

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/api-core-users-access-test'
const PORT = 9915
const url = `http://localhost:${PORT}`
const asJson = (r: Response) => r.json() as Promise<any>

describe('users service — cross-user access control', () => {
  const app = createApp({
    mongodb: MONGO,
    authSecret: 'test-secret-at-least-32-characters-long!!',
    port: PORT,
    host: 'localhost'
  })

  let victimId = ''
  let attackerToken = ''
  let attackerId = ''

  before(async () => {
    await app.listen(PORT)
    // Victim
    const v: any = await app.service('users').create({ email: `victim-${Date.now()}@e.com`, password: 'supersecret', firstName: 'Real' })
    victimId = String(v._id)
    // Attacker
    const creds = { email: `attacker-${Date.now()}@e.com`, password: 'supersecret' }
    const a: any = await app.service('users').create(creds)
    attackerId = String(a._id)
    const auth = await asJson(await fetch(`${url}/authentication`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategy: 'local', ...creds })
    }))
    attackerToken = auth.accessToken
    assert.ok(attackerToken, 'attacker authenticated')
  })

  after(async () => {
    const client = await MongoClient.connect(MONGO)
    await client.db().dropDatabase()
    await client.close()
    await app.teardown()
  })

  it('does NOT let an authenticated user patch another user', async () => {
    const res = await fetch(`${url}/users/${victimId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${attackerToken}` },
      body: JSON.stringify({ firstName: 'HACKED' })
    })
    assert.ok(res.status === 403 || res.status === 404, `cross-user patch should be blocked, got ${res.status}`)

    // Confirm the DB was NOT modified.
    const victim: any = await app.service('users').get(victimId)
    assert.notStrictEqual(victim.firstName, 'HACKED', 'victim record must be unchanged')
  })

  it('does NOT let an authenticated user read another user', async () => {
    const res = await fetch(`${url}/users/${victimId}`, {
      headers: { Authorization: `Bearer ${attackerToken}` }
    })
    assert.ok(res.status === 403 || res.status === 404, `cross-user read should be blocked, got ${res.status}`)
  })

  it('does NOT let an authenticated user remove another user', async () => {
    const res = await fetch(`${url}/users/${victimId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${attackerToken}` }
    })
    assert.ok(res.status === 403 || res.status === 404, `cross-user remove should be blocked, got ${res.status}`)
    const victim: any = await app.service('users').get(victimId)
    assert.ok(victim, 'victim must still exist')
  })

  it('DOES let a user patch their own record', async () => {
    const res = await fetch(`${url}/users/${attackerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${attackerToken}` },
      body: JSON.stringify({ firstName: 'Self' })
    })
    assert.strictEqual(res.status, 200, `self patch should succeed, got ${res.status}`)
    const me: any = await asJson(res)
    assert.strictEqual(me.firstName, 'Self', 'self patch applied')
  })
})
