import assert from 'assert'
import { MongoClient, ObjectId } from 'mongodb'
import { createApp } from '../src'
import type { Application } from '../src'

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/api-core-verifications-test'

const baseOptions = {
  mongodb: MONGO,
  authSecret: 'test-secret-at-least-32-characters-long!!'
}

// Simulate an external (REST) caller. Internal/server-side calls pass provider undefined.
const EXTERNAL = { provider: 'rest' as const }

describe('verifications service — account-takeover hardening', () => {
  let app: Application
  let counter = 0
  const uniq = (label: string) => `${label}-${Date.now()}-${counter++}@example.com`

  // Verification tokens are stripped from external responses, so read them via
  // an internal (trusted) find for test assertions.
  const internalToken = async (email: string): Promise<string> => {
    const res: any = await app.service('verifications').find({ query: { email, used: false } } as any)
    assert.ok(res.data.length > 0, `expected a verification for ${email}`)
    return res.data[0].token
  }

  before(async () => {
    app = createApp(baseOptions as any)
    await app.setup()
  })

  after(async () => {
    const client = await MongoClient.connect(MONGO)
    await client.db().dropDatabase()
    await client.close()
    await app.teardown()
  })

  it('blocks external find / get / remove (no token enumeration)', async () => {
    // Seed one internally so get/remove have a real id to target.
    const seeded: any = await app.service('verifications').create(
      { type: 'password-reset', email: uniq('seed') } as any,
      {} as any
    )
    await assert.rejects(() => app.service('verifications').find({ ...EXTERNAL, query: {} } as any))
    await assert.rejects(() => app.service('verifications').get(seeded._id, EXTERNAL as any))
    await assert.rejects(() => app.service('verifications').remove(seeded._id, EXTERNAL as any))
  })

  it('strips a client-supplied userId on external create', async () => {
    // (The raw token is stripped from external *responses* by the dispatch
    // resolver and can't be read back via find/get — see the disallow test.
    // Here we verify the takeover-adjacent field: an external caller must not be
    // able to bind a verification to an arbitrary account via userId.)
    const email = uniq('create')
    await app.service('verifications').create(
      { type: 'password-reset', email, userId: new ObjectId().toString() } as any,
      EXTERNAL as any
    )

    const internal: any = await app.service('verifications').find({ query: { email } } as any)
    assert.ok(internal.data[0].token, 'token exists internally')
    assert.strictEqual(internal.data[0].userId, undefined, 'client-supplied userId stripped')
  })

  it('rejects external patch (the account-takeover vector)', async () => {
    // Attacker requests a reset for an address THEY control. The create response
    // hands them their own verification's _id (only `token` is stripped), and the
    // token itself arrives by email — so they hold a valid token AND its record id.
    const attackerEmail = uniq('attacker')
    const created: any = await app.service('verifications').create(
      { type: 'password-reset', email: attackerEmail } as any,
      EXTERNAL as any
    )
    assert.ok(created._id, 'create returns the record id to the client')
    const token = await internalToken(attackerEmail)

    // Exploit: re-point that record at a victim (by id), so the token they own now
    // resolves to the victim — then a normal reset would seize the victim account.
    const victimEmail = uniq('victim')
    await assert.rejects(
      () => app.service('verifications').patch(created._id, { email: victimEmail } as any, EXTERNAL as any),
      (err: any) => {
        assert.strictEqual(err.code, 405, 'external patch is Method Not Allowed')
        return true
      }
    )

    // Flipping `used`/`expiresAt` to replay a token must also be rejected.
    await assert.rejects(
      () => app.service('verifications').patch(created._id, { used: false } as any, EXTERNAL as any),
      (err: any) => err.code === 405
    )

    // The verification is untouched — email not swapped.
    const after: any = (await app.service('verifications').find({ query: { token } } as any)).data[0]
    assert.strictEqual(after.email, attackerEmail, 'verification email not mutated')
  })

  it('still allows the legitimate password-reset flow and internal patches', async () => {
    const email = uniq('reset')
    await app.service('users').create({ email, password: 'oldpassword' } as any, {} as any)

    // Self-service reset request (external, anonymous) then reset with the emailed token.
    await app.service('verifications').create({ type: 'password-reset', email } as any, EXTERNAL as any)
    const token = await internalToken(email)

    const result: any = await app.service('verifications').patch(
      null,
      { password: 'newpassword', token } as any,
      EXTERNAL as any
    )
    assert.strictEqual(result.success, true, 'password reset succeeds via external patch(null,{password,token})')

    // The token is now consumed (internal patch inside the flow still works).
    const used: any = (await app.service('verifications').find({ query: { token } } as any)).data[0]
    assert.strictEqual(used.used, true, 'verification marked used internally')

    // The user can authenticate with the NEW password, not the old one.
    const login: any = await app.service('authentication').create(
      { strategy: 'local', email, password: 'newpassword' } as any,
      EXTERNAL as any
    )
    assert.ok(login.accessToken, 'login with new password works')
    await assert.rejects(
      () =>
        app.service('authentication').create(
          { strategy: 'local', email, password: 'oldpassword' } as any,
          EXTERNAL as any
        ),
      'old password no longer works'
    )
  })

  it('rejects external update (defense-in-depth, independent of the methods list)', async () => {
    const email = uniq('upd')
    const created: any = await app.service('verifications').create(
      { type: 'password-reset', email } as any,
      {} as any
    )
    await assert.rejects(
      () =>
        app.service('verifications').update(
          created._id,
          { type: 'password-reset', email: uniq('victim') } as any,
          EXTERNAL as any
        ),
      (err: any) => {
        assert.strictEqual(err.code, 405, 'external update is Method Not Allowed')
        return true
      }
    )
  })

  it('rejects unsupported external verification types', async () => {
    await assert.rejects(
      () => app.service('verifications').create({ type: 'invite', email: uniq('inv') } as any, EXTERNAL as any),
      (err: any) => err.code === 400
    )
  })
})
