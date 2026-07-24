import assert from 'assert'
import { MongoClient } from 'mongodb'
import { Type } from '@feathersjs/typebox'
import { createApp } from '../src'
import type { Application } from '../src'

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/api-core-google-test'

const baseOptions = {
  mongodb: MONGO,
  authSecret: 'test-secret-at-least-32-characters-long!!',
  // A dummy Google client is enough — these tests inject the verified `profile`
  // directly (GoogleStrategy.getProfile returns `data.profile` as-is), so no
  // token is ever exchanged with Google.
  oauth: { google: { key: 'test-client-id', secret: 'test-secret' } },
  authentication: { authStrategies: ['jwt', 'local', 'google', 'google-one-tap'] }
}

// Drive the redirect-style `google` strategy with a pre-built verified profile.
const googleSignIn = (over: Record<string, any>) => ({
  strategy: 'google',
  profile: { given_name: 'G', family_name: 'U', email_verified: true, ...over }
})

describe('Google OAuth strategy (issue #1)', () => {
  let app: Application
  let counter = 0
  const uniq = (label: string) => `${label}-${Date.now()}-${counter++}@example.com`

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

  // #1 — the hard blocker: creating the account on first sign-in must not 400 on
  // the OAuth identity fields (googleId, …). Regression guard for the strict
  // create validator (both plain and extended apps).
  it('creates a new account on first Google sign-in', async () => {
    const email = uniq('fresh')
    const sub = `sub-${Date.now()}-${counter++}`
    const res: any = await app.service('authentication').create(
      googleSignIn({ sub, email }) as any,
      { provider: 'rest' } as any
    )
    assert.ok(res.accessToken, 'issues an access token')
    assert.strictEqual(res.user.email, email, 'stores the Google email')
    assert.strictEqual(res.user.googleId, sub, 'stores the googleId on create')
    assert.strictEqual(res.user.oauthVerified, true, 'marks a fresh OAuth account verified')
  })

  // Returning-user lookup: matching by googleId requires googleId to be a valid
  // query field (findEntity) — guards the query-validation half of the fix.
  it('matches a returning Google user by googleId (no duplicate account)', async () => {
    const email = uniq('return')
    const sub = `sub-${Date.now()}-${counter++}`
    const first: any = await app.service('authentication').create(
      googleSignIn({ sub, email }) as any,
      { provider: 'rest' } as any
    )
    const second: any = await app.service('authentication').create(
      googleSignIn({ sub, email }) as any,
      { provider: 'rest' } as any
    )
    assert.strictEqual(String(second.user._id), String(first.user._id), 'same account on re-login')

    const accounts: any = await app.service('users').find({ query: { googleId: sub }, paginate: false } as any)
    assert.strictEqual(accounts.length, 1, 'exactly one account for the googleId')
  })

  // #2 — linking a provider to the account you're already logged in as. The
  // current user is resolved from the Authorization header, so no duplicate is
  // created even though params.authentication is not a usable JWT here.
  it('links Google to the logged-in account via the Authorization header', async () => {
    const email = uniq('link')
    await app.service('users').create({ email, password: 'supersecret' } as any, { provider: undefined } as any)
    const login: any = await app.service('authentication').create(
      { strategy: 'local', email, password: 'supersecret' } as any,
      { provider: 'rest' } as any
    )
    const sub = `sub-${Date.now()}-${counter++}`
    const linked: any = await app.service('authentication').create(
      googleSignIn({ sub, email }) as any,
      { provider: 'rest', headers: { authorization: `Bearer ${login.accessToken}` } } as any
    )
    assert.strictEqual(String(linked.user._id), String(login.user._id), 'linked to the same account')
    assert.strictEqual(linked.user.googleId, sub, 'googleId written onto the existing account')

    const accounts: any = await app.service('users').find({ query: { email }, paginate: false } as any)
    assert.strictEqual(accounts.length, 1, 'no duplicate account created')
  })

  // #3 — an existing email/password account, Google sign-in with the same
  // verified email and no active session: surface a typed 409 instead of a silent
  // duplicate or an E11000, so the client can drive a link/confirm flow.
  it('rejects a second account for an existing verified email with a typed 409', async () => {
    const email = uniq('collision')
    await app.service('users').create({ email, password: 'supersecret' } as any, { provider: undefined } as any)

    const sub = `sub-${Date.now()}-${counter++}`
    await assert.rejects(
      () =>
        app.service('authentication').create(googleSignIn({ sub, email }) as any, { provider: 'rest' } as any),
      (err: any) => {
        assert.strictEqual(err.code, 409, 'HTTP 409 Conflict')
        assert.strictEqual(err.data?.code, 'google-account-exists', 'typed error code')
        assert.strictEqual(err.data?.email, email, 'echoes the conflicting email')
        return true
      }
    )
  })

  // The collision guard is intentionally scoped to Google-verified emails: an
  // unverified email is not proof of ownership and must not be able to block or
  // probe an existing account.
  it('does not apply the collision guard to an unverified Google email', async () => {
    const email = uniq('unverified')
    await app.service('users').create({ email, password: 'supersecret' } as any, { provider: undefined } as any)

    const sub = `sub-${Date.now()}-${counter++}`
    const res: any = await app.service('authentication').create(
      googleSignIn({ sub, email, email_verified: false }) as any,
      { provider: 'rest' } as any
    )
    assert.ok(res.accessToken, 'proceeds without a 409')
    assert.strictEqual(res.user.oauthVerified, false, 'an unverified sign-in is not marked verified')
  })

  // Linking must never let the Google identity clobber the account's primary
  // login email — otherwise linking a Google account whose email differs (or
  // belongs to someone else) would change/hijack the login identity.
  it('links Google without overwriting the account primary email', async () => {
    const primaryEmail = uniq('primary')
    await app.service('users').create({ email: primaryEmail, password: 'supersecret' } as any, { provider: undefined } as any)
    const login: any = await app.service('authentication').create(
      { strategy: 'local', email: primaryEmail, password: 'supersecret' } as any,
      { provider: 'rest' } as any
    )
    const googleEmail = uniq('googlemail') // a DIFFERENT verified Google email
    const sub = `sub-${Date.now()}-${counter++}`
    const linked: any = await app.service('authentication').create(
      googleSignIn({ sub, email: googleEmail }) as any,
      { provider: 'rest', headers: { authorization: `Bearer ${login.accessToken}` } } as any
    )
    assert.strictEqual(String(linked.user._id), String(login.user._id), 'linked to the logged-in account')
    assert.strictEqual(linked.user.email, primaryEmail, 'primary login email preserved')
    assert.strictEqual(linked.user.googleId, sub, 'googleId linked')
    assert.strictEqual(linked.user.googleEmail, googleEmail, 'googleEmail recorded separately')

    // The original password login must still resolve the same account.
    const relogin: any = await app.service('authentication').create(
      { strategy: 'local', email: primaryEmail, password: 'supersecret' } as any,
      { provider: 'rest' } as any
    )
    assert.strictEqual(String(relogin.user._id), String(login.user._id), 'password login intact after linking')
  })

  // Linking also works when the current user is carried in params.authentication
  // as a JWT (e.g. the standard header-parsed path), not just a raw Bearer header.
  it('resolves the current user from a JWT in params.authentication when linking', async () => {
    const email = uniq('jwtlink')
    await app.service('users').create({ email, password: 'supersecret' } as any, { provider: undefined } as any)
    const login: any = await app.service('authentication').create(
      { strategy: 'local', email, password: 'supersecret' } as any,
      { provider: 'rest' } as any
    )
    const sub = `sub-${Date.now()}-${counter++}`
    const linked: any = await app.service('authentication').create(
      googleSignIn({ sub, email }) as any,
      { provider: 'rest', authentication: { strategy: 'jwt', accessToken: login.accessToken } } as any
    )
    assert.strictEqual(String(linked.user._id), String(login.user._id), 'linked via params.authentication jwt')
    assert.strictEqual(linked.user.googleId, sub)
  })

  // A returning login where Google reports the email as unverified must not
  // downgrade a previously-verified account.
  it('does not downgrade verified status on a returning login', async () => {
    const email = uniq('downgrade')
    const sub = `sub-${Date.now()}-${counter++}`
    const first: any = await app.service('authentication').create(
      googleSignIn({ sub, email, email_verified: true }) as any,
      { provider: 'rest' } as any
    )
    assert.strictEqual(first.user.emailVerified, true, 'verified on first sign-in')
    const second: any = await app.service('authentication').create(
      googleSignIn({ sub, email, email_verified: false }) as any,
      { provider: 'rest' } as any
    )
    assert.strictEqual(String(second.user._id), String(first.user._id), 'same account')
    assert.strictEqual(second.user.emailVerified, true, 'verified status not downgraded')
  })

  // The redirect (browser) flow must carry the typed code so the client can
  // branch on it, not just a generic error message.
  it('propagates the typed error code through the OAuth redirect', async () => {
    const { Conflict } = await import('@feathersjs/errors')
    const strategy: any = (app.service('authentication') as any).strategies.google
    const url: string = await strategy.getRedirect(
      new Conflict('An account already exists for this email address.', {
        code: 'google-account-exists',
        email: 'someone@example.com'
      }),
      {}
    )
    assert.ok(url.includes('code=google-account-exists'), 'redirect URL carries the typed code')
  })
})

// The exact shape from the report: a consumer that extends `users` (rebuilding
// the data validator with additionalProperties:false) attempting a first-time
// Google sign-in. Before the fix this 400'd with `additionalProperty "googleId"`.
describe('Google OAuth with an extended users service (issue #1 repro)', () => {
  let app: Application

  before(async () => {
    app = createApp({
      ...baseOptions,
      extend: { users: { properties: { profile: Type.Optional(Type.String()) } } }
    } as any)
    await app.setup()
  })

  after(async () => {
    const client = await MongoClient.connect(MONGO)
    await client.db().dropDatabase()
    await client.close()
    await app.teardown()
  })

  it('does not 400 on the OAuth identity fields when users is extended', async () => {
    const email = `extended-${Date.now()}@example.com`
    const sub = `sub-extended-${Date.now()}`
    const res: any = await app.service('authentication').create(
      googleSignIn({ sub, email }) as any,
      { provider: 'rest' } as any
    )
    assert.strictEqual(res.user.googleId, sub, 'googleId stored on the extended service')
    assert.strictEqual(res.user.email, email)
  })
})
