import assert from 'assert'
import { app } from '../src/app'

// Example test for the bundled `widgets` service. If you remove the widgets
// example, delete this file too.

const port = app.get('port')
const appUrl = `http://${app.get('host')}:${port}`

const asJson = (res: Response) => res.json() as Promise<any>

describe('widgets service', () => {
  let accessToken = ''
  let userId = ''

  before(async () => {
    await app.listen(port)

    // Register + authenticate a user to exercise the tenant-scoped service.
    const creds = { email: `w-${Date.now()}@example.com`, password: 'supersecret' }
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
    accessToken = data.accessToken
    userId = data.user._id
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

  it('creates a tenant-scoped widget through the custom service', async () => {
    const res = await fetch(`${appUrl}/widgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ name: 'Test Widget' })
    })
    const widget = await asJson(res)

    assert.strictEqual(res.status, 201, 'widget created')
    assert.strictEqual(widget.name, 'Test Widget')
    assert.ok(widget.organizationId, 'widget is scoped to an organization')
  })

  it('rejects unauthenticated widget access', async () => {
    const res = await fetch(`${appUrl}/widgets`)
    assert.ok(res.status === 401 || res.status === 403, `expected auth error, got ${res.status}`)
  })
})
