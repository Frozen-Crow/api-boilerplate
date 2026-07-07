import assert from 'assert'
import { app } from '../src/app'

const port = app.get('port')
const appUrl = `http://${app.get('host')}:${port}`

describe('Feathers application tests', () => {
    before(async () => {
        await app.listen(port)
    })

    after(async () => {
        await app.teardown()
    })

    it('starts and shows the index page', async () => {
        const response = await fetch(appUrl)
        const text = await response.text()
        assert.ok(text.indexOf('API is running') !== -1)
    })

    it('shows a 404 JSON error', async () => {
        const response = await fetch(`${appUrl}/path/to/nowhere`)
        assert.strictEqual(response.status, 404)
        const data = await response.json() as any
        assert.strictEqual(data.code, 404)
        assert.strictEqual(data.name, 'NotFound')
    })

    it('attaches socket.io even with seeding enabled', async () => {
        // Regression test: the core's seed setup hook must call next(), or the
        // setup chain stops and @feathersjs/socketio never attaches to the HTTP
        // server (this config runs with seed: true).
        assert.ok((app as any).io, 'app.io should be set after listen()')
    })
})
