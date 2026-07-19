import assert from 'assert'
import { MongoClient, ObjectId } from 'mongodb'
import { createApp } from '../src'
import { populateUserRoles } from '../src/hooks/populate-user-roles'
import { isGlobalAdmin } from '../src/utils/access'

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/api-core-populate-roles-test'

describe('populate-user-roles', () => {
  const app = createApp({ mongodb: MONGO, authSecret: 'test-secret-at-least-32-characters!!', seed: true })

  before(async () => {
    await app.setup()
  })

  after(async () => {
    const client = await MongoClient.connect(MONGO)
    await client.db().dropDatabase()
    await client.close()
    await app.teardown()
  })

  it('populates a role ObjectId into the full role object', async () => {
    const admin: any = (await app.service('roles').find({ query: { name: 'Admin' }, paginate: false }) as any)[0]
    const u: any = await app.service('users').create({ email: `pr-${Date.now()}@e.com`, password: 'supersecret' })
    await app.service('users').patch(u._id, { role: [admin._id] } as any, { provider: undefined } as any)

    const fetched: any = await app.service('users').get(u._id)
    assert.ok(Array.isArray(fetched.role) && fetched.role.length === 1, 'role array present')
    assert.strictEqual(fetched.role[0].name, 'Admin', 'role ObjectId populated to the full object')
    // Downstream check that was broken by the wipe:
    assert.strictEqual(isGlobalAdmin(fetched), true, 'isGlobalAdmin sees the populated Admin role')
  })

  it('does NOT erase role ids when the lookup finds nothing', async () => {
    const orphan = new ObjectId() // valid id, but no such role exists
    const u: any = await app.service('users').create({ email: `pr2-${Date.now()}@e.com`, password: 'supersecret' })
    await app.service('users').patch(u._id, { role: [orphan] } as any, { provider: undefined } as any)

    const fetched: any = await app.service('users').get(u._id)
    assert.strictEqual(fetched.role.length, 1, 'ids preserved, not wiped to []')
    assert.strictEqual(String(fetched.role[0]), String(orphan), 'the raw id survives a lookup miss')
    assert.strictEqual(fetched.role[0].name, undefined, 'left as a raw id, not a (missing) object')
  })

  it('leaves role ids unchanged if the roles lookup throws', async () => {
    const ids = [new ObjectId()]
    const context: any = {
      method: 'get',
      result: { role: ids },
      params: {},
      app: { service: () => ({ find: async () => { throw new Error('boom') } }) }
    }
    await populateUserRoles()(context)
    assert.deepStrictEqual(context.result.role, ids, 'role ids untouched when the lookup errors')
  })
})
