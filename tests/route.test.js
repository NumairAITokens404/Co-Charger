import test from 'node:test'
import assert from 'node:assert/strict'
import handler from '../api/route.js'

function response() {
  return {
    code: null, body: null,
    setHeader() {},
    status(code) { this.code = code; return this },
    json(body) { this.body = body; return this }
  }
}

test('route service fails closed when unavailable', async () => {
  const saved = process.env.ORS_API_KEY
  delete process.env.ORS_API_KEY
  const result = response()
  await handler({ method: 'POST', body: { from: [17.385, 78.4867], to: [17.4, 78.5] } }, result)
  assert.equal(result.code, 503)
  if (saved) process.env.ORS_API_KEY = saved
})

test('route service rejects invalid coordinates', async () => {
  const result = response()
  await handler({ method: 'POST', body: { from: [0, 0], to: [17.4, 78.5] } }, result)
  assert.equal(result.code, 400)
})

test('route service returns driving distance', async () => {
  const savedKey = process.env.ORS_API_KEY
  const savedFetch = globalThis.fetch
  process.env.ORS_API_KEY = 'test-key'
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ routes: [{ summary: { distance: 12345 } }] }) })
  try {
    const result = response()
    await handler({ method: 'POST', body: { from: [17.385, 78.4867], to: [17.4, 78.5] } }, result)
    assert.equal(result.code, 200)
    assert.equal(result.body.km, 12.3)
  } finally {
    globalThis.fetch = savedFetch
    if (savedKey) process.env.ORS_API_KEY = savedKey
    else delete process.env.ORS_API_KEY
  }
})
