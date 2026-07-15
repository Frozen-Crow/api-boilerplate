import assert from 'assert'
import { MongoClient } from 'mongodb'
import { Type } from '@feathersjs/typebox'
import { createApp } from '../src'

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/api-core-extend-test'

const baseOptions = {
  mongodb: MONGO,
  authSecret: 'test-secret-at-least-32-characters-long!!'
}

describe('extending core services', () => {
  after(async () => {
    const client = await MongoClient.connect(MONGO)
    await client.db().dropDatabase()
    await client.close()
  })

  it('adds a stored + queryable field and computed field to users', async () => {
    const app = createApp({
      ...baseOptions,
      extend: {
        users: {
          properties: { phone: Type.Optional(Type.String()), source: Type.Optional(Type.String()) },
          queryProperties: { phone: Type.String() },
          resolvers: {
            data: { source: async (v: any) => v ?? 'api' },
            result: { hasPhone: async (_v: any, u: any) => !!u.phone }
          }
        }
      }
    })
    await app.setup()

    const users = app.service('users')
    const email = `ext-${Date.now()}@example.com`

    const created: any = await users.create({ email, password: 'supersecret', phone: '555-1234' } as any)
    assert.strictEqual(created.phone, '555-1234', 'extended field stored on create')
    assert.strictEqual(created.source, 'api', 'data resolver applied')

    const fetched: any = await users.get(created._id)
    assert.strictEqual(fetched.phone, '555-1234', 'stored field returned')
    assert.strictEqual(fetched.hasPhone, true, 'computed result field present')

    const found: any = await users.find({ query: { phone: '555-1234' }, paginate: false } as any)
    assert.ok(found.some((u: any) => String(u._id) === String(created._id)), 'queryable by extended field')

    const patched: any = await users.patch(created._id, { phone: '555-9999' } as any)
    assert.strictEqual(patched.phone, '555-9999', 'extended field patchable')

    await app.teardown()
  })

  it('still rejects truly-unknown fields (additionalProperties:false intact)', async () => {
    const app = createApp({
      ...baseOptions,
      extend: { users: { properties: { phone: Type.Optional(Type.String()) } } }
    })
    await app.setup()
    let threw = false
    try {
      await app.service('users').create({ email: `u-${Date.now()}@e.com`, password: 'supersecret', bogus: 'x' } as any)
    } catch {
      threw = true
    }
    assert.ok(threw, 'unknown field rejected')
    await app.teardown()
  })

  it('extends an Intersect-based service (roles)', async () => {
    // roles has a Type.Intersect data schema (no flat Type.Pick) — proves the
    // recomposition works for the Intersect case too.
    const app = createApp({
      ...baseOptions,
      extend: { roles: { properties: { tier: Type.Optional(Type.String()) } } }
    })
    await app.setup()
    const role: any = await app.service('roles').create(
      { name: `role-${Date.now()}`, permissions: [], tier: 'gold' } as any,
      { provider: undefined } as any
    )
    assert.strictEqual(role.tier, 'gold', 'extended field stored on Intersect-based service')
    await app.teardown()
  })

  it('merges extension hooks', async () => {
    let ran = false
    const app = createApp({
      ...baseOptions,
      extend: {
        users: {
          hooks: { after: { create: [async (ctx: any) => { ran = true; return ctx }] } }
        }
      }
    })
    await app.setup()
    await app.service('users').create({ email: `h-${Date.now()}@e.com`, password: 'supersecret' } as any)
    assert.ok(ran, 'extension hook ran')
    await app.teardown()
  })
})
