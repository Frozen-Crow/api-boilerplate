import assert from 'assert'
import { app } from '../src/app'

const port = app.get('port')
const appUrl = `http://${app.get('host')}:${port}`

const asJson = (res: Response) => res.json() as Promise<any>

describe('authentication', () => {
  let userId = ''

  before(async () => {
    await app.listen(port)
  })

  after(async () => {
    if (userId) {
      try {
        await app.service('users').remove(userId)
      } catch {
        /* ignore cleanup errors */
      }
    }
    await app.teardown()
  })

  it('registers and authenticates a user, hiding the password', async () => {
    const creds = { email: `t-${Date.now()}@example.com`, password: 'supersecret' }

    await fetch(`${appUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creds)
    })

    const res = await fetch(`${appUrl}/authentication`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategy: 'local', ...creds })
    })
    const data = await asJson(res)

    assert.ok(data.accessToken, 'issues an access token')
    assert.ok(data.user, 'returns the user')
    assert.strictEqual(data.user.password, undefined, 'password is hidden to clients')

    userId = data.user._id
  })
})
