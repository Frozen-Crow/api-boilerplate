import assert from 'assert'
import { extractBearerToken } from '../src/strategies/google-utils'
import { preventRoleChange } from '../src/hooks/prevent-role-change'

describe('extractBearerToken', () => {
  it('extracts the token from a lowercase authorization header', () => {
    assert.strictEqual(extractBearerToken({ authorization: 'Bearer abc.def.ghi' }), 'abc.def.ghi')
  })

  it('extracts the token from a capitalized Authorization header', () => {
    assert.strictEqual(extractBearerToken({ Authorization: 'Bearer abc.def.ghi' }), 'abc.def.ghi')
  })

  it('is case-insensitive on the scheme and tolerates extra whitespace', () => {
    assert.strictEqual(extractBearerToken({ authorization: '  bearer   abc.def.ghi  ' }), 'abc.def.ghi')
  })

  it('returns null for a non-bearer scheme', () => {
    assert.strictEqual(extractBearerToken({ authorization: 'Basic dXNlcjpwYXNz' }), null)
  })

  it('returns null when the header or token is missing', () => {
    assert.strictEqual(extractBearerToken({ authorization: 'Bearer ' }), null)
    assert.strictEqual(extractBearerToken({}), null)
    assert.strictEqual(extractBearerToken(undefined), null)
    assert.strictEqual(extractBearerToken(null), null)
    assert.strictEqual(extractBearerToken({ authorization: 42 as any }), null)
  })
})

// Guards the security assumption behind adding the OAuth fields to userDataSchema:
// the create validator now *accepts* googleId/oauthVerified, so the only thing
// keeping an external client from self-assigning them is this hook.
describe('preventRoleChange (OAuth identity fields)', () => {
  it('strips OAuth identity fields from external non-admin writes', async () => {
    const context: any = {
      data: { email: 'x@example.com', password: 'p', googleId: 'attacker', oauthVerified: true, emailVerified: true },
      params: { provider: 'rest' } // external request, no params.user => not an admin
    }
    await preventRoleChange()(context)
    assert.strictEqual(context.data.googleId, undefined, 'googleId stripped')
    assert.strictEqual(context.data.oauthVerified, undefined, 'oauthVerified stripped')
    assert.strictEqual(context.data.emailVerified, undefined, 'emailVerified stripped')
    assert.strictEqual(context.data.email, 'x@example.com', 'ordinary fields kept')
  })

  it('leaves internal (server-side) writes untouched', async () => {
    const context: any = {
      data: { email: 'x@example.com', googleId: 'g-1', oauthVerified: true },
      params: {} // provider undefined => trusted internal call (the OAuth strategy)
    }
    await preventRoleChange()(context)
    assert.strictEqual(context.data.googleId, 'g-1', 'internal write keeps googleId')
    assert.strictEqual(context.data.oauthVerified, true, 'internal write keeps oauthVerified')
  })
})
