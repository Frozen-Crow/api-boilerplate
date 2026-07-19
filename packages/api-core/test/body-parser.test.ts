import assert from 'assert'
import { MongoClient } from 'mongodb'
import { createApp } from '../src'

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/api-core-bodyparser-test'

describe('configurable body parser limit', () => {
  after(async () => {
    const client = await MongoClient.connect(MONGO)
    await client.db().dropDatabase()
    await client.close()
  })

  it('accepts a >1MB JSON body when jsonLimit is raised', async () => {
    // Koa's default jsonLimit is 1MB; without the option a 1.5MB body is rejected.
    const app = createApp({
      mongodb: MONGO,
      authSecret: 'test-secret-at-least-32-characters!!',
      port: 9918,
      bodyParser: { jsonLimit: '4mb' }
    })
    await app.listen(9918)

    const big = 'x'.repeat(1_500_000)
    const res = await fetch('http://localhost:9918/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `b-${Date.now()}@e.com`, password: 'supersecret', firstName: big })
    })

    // The body parser accepted the >1MB payload (no 413) and the create ran.
    assert.notStrictEqual(res.status, 413, 'raised limit should accept the body')
    assert.strictEqual(res.status, 201, `expected the create to succeed, got ${res.status}`)

    await app.teardown()
  })
})
