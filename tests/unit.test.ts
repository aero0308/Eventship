/**
 * Unit tests for pure, client-safe utility modules (no server imports, no
 * HTTP): password policy, query-string builder, error describer and the
 * rate-limiter state machine (with injected clock — no real waiting).
 */

import { describe, expect, it } from 'bun:test'
import { strongPassword } from '../src/lib/schemas'
import { qs } from '../src/lib/api-client'
import { describeError } from '../src/lib/describe-error'
import { clientIpFrom, createRateLimiter } from '../src/lib/rate-limit'

describe('strongPassword policy', () => {
  it('accepts a compliant password', () => {
    expect(strongPassword.safeParse('Str0ng!Pass').success).toBe(true)
  })

  it('rejects missing character classes and short lengths', () => {
    const cases: Array<[string, string]> = [
      ['Sh0rt!', 'at least 8'],
      ['no-uppercase-1!', 'uppercase'],
      ['NO-LOWERCASE-1!', 'lowercase'],
      ['NoNumbers!!', 'number'],
      ['NoSpecial11A', 'special'],
    ]
    for (const [password, expectedFragment] of cases) {
      const result = strongPassword.safeParse(password)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message.toLowerCase()).toContain(expectedFragment)
      }
    }
  })

  it('rejects non-string input', () => {
    expect(strongPassword.safeParse(42).success).toBe(false)
  })
})

describe('qs() query builder', () => {
  it('skips empty values and joins the rest', () => {
    expect(qs({ a: 'x', b: undefined, c: null, d: '', e: 5 })).toBe('?a=x&e=5')
  })

  it('returns an empty string when everything is empty', () => {
    expect(qs({ a: undefined, b: null, c: '' })).toBe('')
  })

  it('URL-encodes values (URLSearchParams form-encoding: space → +)', () => {
    expect(qs({ q: 'open air stage' })).toBe('?q=open+air+stage')
  })
})

describe('describeError()', () => {
  it('passes through ApiClientError messages', () => {
    const error = new (class extends Error {
      constructor() {
        super('Invalid due date: cannot be in the past')
        this.name = 'ApiClientError'
      }
    })()
    expect(describeError(error)).toBe('Invalid due date: cannot be in the past')
  })

  it('maps TypeError to a network message', () => {
    expect(describeError(new TypeError('fetch failed'))).toContain('Network error')
  })

  it('maps raw strings and unknown values', () => {
    expect(describeError('boom')).toBe('boom')
    expect(describeError(null)).toContain('Something went wrong')
  })
})

describe('createRateLimiter()', () => {
  const WINDOW = 60_000

  it('allows up to max, then blocks with retryAfter', () => {
    const limiter = createRateLimiter({ name: 'unit', windowMs: WINDOW, max: 3 })
    const t0 = 1_000_000

    expect(limiter.check('ip-a', t0).allowed).toBe(true)
    expect(limiter.check('ip-a', t0 + 1).allowed).toBe(true)
    expect(limiter.check('ip-a', t0 + 2).allowed).toBe(true)
    const denied = limiter.check('ip-a', t0 + 3)
    expect(denied.allowed).toBe(false)
    expect(denied.retryAfterSeconds).toBeGreaterThan(0)
    expect(denied.retryAfterSeconds).toBeLessThanOrEqual(60)
  })

  it('keys buckets independently', () => {
    const limiter = createRateLimiter({ name: 'unit', windowMs: WINDOW, max: 1 })
    expect(limiter.check('ip-x', 0).allowed).toBe(true)
    expect(limiter.check('ip-y', 0).allowed).toBe(true)
    expect(limiter.check('ip-x', 1).allowed).toBe(false)
  })

  it('frees the window once entries age out', () => {
    const limiter = createRateLimiter({ name: 'unit', windowMs: WINDOW, max: 1 })
    expect(limiter.check('ip-z', 0).allowed).toBe(true)
    expect(limiter.check('ip-z', WINDOW / 2).allowed).toBe(false)
    expect(limiter.check('ip-z', WINDOW + 1).allowed).toBe(true)
  })

  it('reset() clears every bucket', () => {
    const limiter = createRateLimiter({ name: 'unit', windowMs: WINDOW, max: 1 })
    limiter.check('ip-r', 0)
    limiter.reset()
    expect(limiter.check('ip-r', 0).allowed).toBe(true)
  })

  it('counts remaining attempts', () => {
    const limiter = createRateLimiter({ name: 'unit', windowMs: WINDOW, max: 3 })
    expect(limiter.check('ip-c', 0).remaining).toBe(2)
    expect(limiter.check('ip-c', 0).remaining).toBe(1)
    expect(limiter.check('ip-c', 0).remaining).toBe(0)
  })
})

describe('clientIpFrom()', () => {
  it('prefers the first x-forwarded-for hop', () => {
    const request = new Request('http://localhost/api/health', {
      headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
    })
    expect(clientIpFrom(request)).toBe('203.0.113.5')
  })

  it('falls back to x-real-ip then "unknown"', () => {
    const real = new Request('http://localhost/api/health', {
      headers: { 'x-real-ip': '198.51.100.9' },
    })
    expect(clientIpFrom(real)).toBe('198.51.100.9')
    expect(clientIpFrom(new Request('http://localhost/api/health'))).toBe('unknown')
  })
})
