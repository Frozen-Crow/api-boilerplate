import assert from 'assert'
import { MongoClient } from 'mongodb'
import { Type } from '@feathersjs/typebox'
import { createApp } from '../src'

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/api-core-extend-writability-test'
const PORT = 9918
const url = `http://localhost:${PORT}`
const asJson = (r: Response) => r.json() as Promise<any>

// Issue #2: extended properties must be server-owned by default — an external
// client cannot self-write them unless the consumer marks them clientWritable.
describe('extend: server-owned vs clientWritable fields (issue #2)', () => {
  const app = createApp({
    mongodb: MONGO,
    authSecret: 'test-secret-at-least-32-characters-long!!',
    port: PORT,
    host: 'localhost',
    seed: true,
    extend: {
      users: {
        // `entitlement` is server-owned app state; `phone` is user-editable.
        properties: {
          entitlement: Type.Optional(Type.String()),
          phone: Type.Optional(Type.String())
        },
        clientWritable: ['phone']
      }
    }
  } as any)

  const authHeaders = (t: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${t}` })

  before(async () => {
    await app.listen(PORT)
  })

  after(async () => {
    const client = await MongoClient.connect(MONGO)
    await client.db().dropDatabase()
    await client.close()
    await app.teardown()
  })

  it('strips a server-owned extended field from an external self-PATCH, but keeps a clientWritable one', async () => {
    const creds = { email: `owner-${Date.now()}@e.com`, password: 'supersecret' }
    const user: any = await app.service('users').create(creds)
    const token = (
      await asJson(
        await fetch(`${url}/authentication`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ strategy: 'local', ...creds })
        })
      )
    ).accessToken
    assert.ok(token, 'authenticated')

    const res = await fetch(`${url}/users/${user._id}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ entitlement: 'paid', phone: '555-1234' })
    })
    assert.strictEqual(res.status, 200, 'self-patch allowed')

    const fresh: any = await app.service('users').get(String(user._id))
    assert.strictEqual(fresh.entitlement, undefined, 'server-owned field NOT self-writable')
    assert.strictEqual(fresh.phone, '555-1234', 'clientWritable field written')
  })

  it('strips a server-owned extended field from an anonymous signup', async () => {
    const email = `signup-${Date.now()}@e.com`
    const res = await fetch(`${url}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'supersecret', entitlement: 'paid' })
    })
    assert.strictEqual(res.status, 201, 'signup created')
    const created: any = await app.service('users').get((await asJson(res))._id)
    assert.strictEqual(created.entitlement, undefined, 'entitlement not self-assignable at signup')
  })

  it('allows internal (server-side) writes of server-owned fields', async () => {
    const u: any = await app.service('users').create({
      email: `internal-${Date.now()}@e.com`,
      password: 'supersecret',
      entitlement: 'paid'
    } as any)
    assert.strictEqual(u.entitlement, 'paid', 'internal write keeps server-owned field')
  })

  it('allows a global admin to write server-owned fields externally', async () => {
    const adminRole: any = ((await app.service('roles').find({ query: { name: 'Admin' }, paginate: false } as any)) as any)[0]
    const creds = { email: `admin-${Date.now()}@e.com`, password: 'supersecret' }
    const admin: any = await app.service('users').create(creds)
    await app.service('users').patch(String(admin._id), { role: [adminRole._id] } as any) // internal, allowed
    const token = (
      await asJson(
        await fetch(`${url}/authentication`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ strategy: 'local', ...creds })
        })
      )
    ).accessToken

    const res = await fetch(`${url}/users/${admin._id}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ entitlement: 'paid' })
    })
    assert.strictEqual(res.status, 200)
    const fresh: any = await app.service('users').get(String(admin._id))
    assert.strictEqual(fresh.entitlement, 'paid', 'global admin may set server-owned fields')
  })
})
