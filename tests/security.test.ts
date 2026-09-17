/**
 * Security integration tests — response headers + auth rate limiting.
 *
 * Rate-limit tests deliberately use a DEDICATED fake IP per limiter so the
 * buckets used by the other suites (unique IP each client) stay untouched.
 */

import { beforeAll, describe, expect, it } from 'bun:test'
import { BASE_URL, TestClient, waitForServer } from './helpers'

beforeAll(async () => {
  await waitForServer()
}, 60_000)

describe('security response headers (next.config headers())', () => {
  it('API responses carry nosniff / DENY / referrer / permissions policies', async () => {
    const res = await fetch(`${BASE_URL}/api/health`)
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('x-frame-options')).toBe('DENY')
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
    expect(res.headers.get('permissions-policy')).toContain('camera=()')
  })

  it('page responses carry the same headers', async () => {
    const res = await fetch(`${BASE_URL}/`)
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('x-frame-options')).toBe('DENY')
  })
})

describe('auth rate limiting (per-IP sliding window)', () => {
  it('forgot-password allows 3/min then answers 429 with Retry-After', async () => {
    const client = new TestClient('10.99.31.7') // dedicated bucket
    const payload = { email: 'ratelimit-probe@qa.eventship.io' }

    for (let i = 0; i < 3; i += 1) {
      const res = await client.post('/auth/forgot-password', payload)
      expect(res.status).toBe(200)
    }

    const fourth = await client.post('/auth/forgot-password', payload)
    expect(fourth.status).toBe(429)
    expect(Number(fourth.headers.get('retry-after'))).toBeGreaterThan(0)
    expect((fourth.data as { error?: string })?.error ?? '').toContain('Too many attempts')
  })

  it('login allows 10/min then answers 429 with Retry-After', async () => {
    const client = new TestClient('10.99.31.8') // dedicated bucket
    const payload = { email: 'ratelimit-login@qa.eventship.io', password: 'Wrong!Pass1' }

    for (let i = 0; i < 10; i += 1) {
      const res = await client.post('/auth/login', payload)
      expect(res.status).toBe(401) // every attempt is processed (bad credentials)
    }

    const eleventh = await client.post('/auth/login', payload)
    expect(eleventh.status).toBe(429)
    expect(Number(eleventh.headers.get('retry-after'))).toBeGreaterThan(0)
  })

  it('a different IP is unaffected by another bucket being full', async () => {
    const fresh = new TestClient('10.99.31.9')
    const res = await fresh.post('/auth/login', {
      email: 'ratelimit-other@qa.eventship.io',
      password: 'Wrong!Pass1',
    })
    expect(res.status).toBe(401) // processed normally, NOT 429
  })
})
