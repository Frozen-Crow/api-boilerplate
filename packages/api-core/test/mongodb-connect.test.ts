import assert from 'assert'
import { connectWithRetry } from '../src/mongodb'

// Pure unit tests for the initial-connect retry logic (issue #4). No real Mongo
// needed — the connect function is injected.
describe('connectWithRetry (issue #4)', () => {
  const fakeClient = (dbMarker: any = {}) => ({ db: () => dbMarker }) as any

  it('returns the Db on first success', async () => {
    let calls = 0
    const db: any = await connectWithRetry('uri', 'appdb', { retryBaseDelayMS: 1 }, async () => {
      calls++
      return fakeClient({ ok: true })
    })
    assert.strictEqual(calls, 1)
    assert.strictEqual(db.ok, true)
  })

  it('retries transient failures with backoff, then succeeds', async () => {
    let calls = 0
    const db: any = await connectWithRetry(
      'uri',
      'appdb',
      { maxAttempts: 5, retryBaseDelayMS: 1, maxRetryDelayMS: 2 },
      async () => {
        calls++
        if (calls < 3) throw new Error('server selection timed out')
        return fakeClient({ ok: true })
      }
    )
    assert.strictEqual(calls, 3, 'retried until success')
    assert.strictEqual(db.ok, true)
  })

  it('throws after exhausting maxAttempts (never a permanently-rejected cache)', async () => {
    let calls = 0
    await assert.rejects(
      () =>
        connectWithRetry('uri', 'appdb', { maxAttempts: 3, retryBaseDelayMS: 1, maxRetryDelayMS: 2 }, async () => {
          calls++
          throw new Error('boom')
        }),
      /boom/
    )
    assert.strictEqual(calls, 3, 'tried exactly maxAttempts times')
  })

  it('passes explicit driver timeouts to the client', async () => {
    let seenOpts: any
    await connectWithRetry(
      'uri',
      'appdb',
      { serverSelectionTimeoutMS: 1234, connectTimeoutMS: 5678 },
      async (_uri, opts) => {
        seenOpts = opts
        return fakeClient()
      }
    )
    assert.strictEqual(seenOpts.serverSelectionTimeoutMS, 1234)
    assert.strictEqual(seenOpts.connectTimeoutMS, 5678)
  })
})
