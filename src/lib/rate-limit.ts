/**
 * In-memory rate limiter for sensitive API routes (Phase: Testing & Polish).
 *
 * Design constraints:
 * - Single-box demo deployment (no Redis) → a per-process sliding window is
 *   the right tool; state lives in module scope and survives across requests
 *   within one server instance.
 * - The app sits behind the Caddy gateway, so client identity comes from
 *   `x-forwarded-for` (first hop) with `x-real-ip` as fallback.
 * - RateLimitError is a subclass of ApiError so the existing `handleApiError`
 *   contract keeps working — it just adds a `Retry-After` header on top.
 */

export interface RateLimiterOptions {
  /** Unique bucket name, used in log lines. */
  name: string
  /** Window length in milliseconds. */
  windowMs: number
  /** Maximum requests allowed inside one window. */
  max: number
}

export interface RateLimitDecision {
  allowed: boolean
  /** Seconds until the window frees up (always >= 1, for Retry-After). */
  retryAfterSeconds: number
  /** Requests remaining in the current window (0 when denied). */
  remaining: number
}

interface HitRecord {
  /** Timestamps of accepted (or at least counted) hits inside the window. */
  hits: number[]
}

export class RateLimitError extends Error {
  readonly status = 429
  readonly retryAfterSeconds: number

  constructor(retryAfterSeconds: number, message?: string) {
    super(message ?? `Too many requests. Try again in ${retryAfterSeconds}s.`)
    this.name = 'RateLimitError'
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export function createRateLimiter(options: RateLimiterOptions) {
  const { name, windowMs, max } = options
  /** key → hit timestamps. Bounded implicitly by pruning stale entries. */
  const store = new Map<string, HitRecord>()
  let lastPrune = Date.now()

  function prune(now: number): void {
    // Prune at most once per window to keep the map from growing unbounded.
    if (now - lastPrune < windowMs) return
    lastPrune = now
    for (const [key, record] of store) {
      record.hits = record.hits.filter((t) => now - t < windowMs)
      if (record.hits.length === 0) store.delete(key)
    }
  }

  return {
    name,
    max,
    windowMs,

    /** Record a hit for `key` and decide whether it is allowed. */
    check(key: string, now: number = Date.now()): RateLimitDecision {
      prune(now)
      const record = store.get(key) ?? { hits: [] }
      record.hits = record.hits.filter((t) => now - t < windowMs)

      if (record.hits.length >= max) {
        const oldest = record.hits[0] ?? now
        const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000))
        store.set(key, record)
        return { allowed: false, retryAfterSeconds, remaining: 0 }
      }

      record.hits.push(now)
      store.set(key, record)
      return {
        allowed: true,
        retryAfterSeconds: 0,
        remaining: Math.max(0, max - record.hits.length),
      }
    },

    /** Clear all state (used by tests and admin tooling). */
    reset(): void {
      store.clear()
      lastPrune = Date.now()
    },
  }
}

export type RateLimiter = ReturnType<typeof createRateLimiter>

/** Extract the best-effort client IP from proxy headers. */
export function clientIpFrom(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

/**
 * Check the limiter and throw a RateLimitError (429) when the bucket is full.
 * The thrown error carries `retryAfterSeconds` so handleApiError can emit the
 * Retry-After header.
 */
export function enforceRateLimit(limiter: RateLimiter, request: Request): void {
  const key = clientIpFrom(request)
  const decision = limiter.check(key)
  if (!decision.allowed) {
    console.warn(
      `[rate-limit] ${limiter.name} blocked ${key} for ${decision.retryAfterSeconds}s`
    )
    throw new RateLimitError(
      decision.retryAfterSeconds,
      `Too many attempts. Please try again in ${decision.retryAfterSeconds}s.`
    )
  }
}

// ============ shared route limiters ============
// Limits are sized for a demo box: strict enough to blunt credential
// stuffing, loose enough that a normal user (and the test-suite's distinct
// per-test fake IPs) never hits them.

/** POST /api/auth/login — 10 attempts/min/IP (successes and failures alike). */
export const loginLimiter = createRateLimiter({ name: 'auth:login', windowMs: 60_000, max: 10 })

/** POST /api/auth/register — 5 accounts/min/IP. */
export const registerLimiter = createRateLimiter({ name: 'auth:register', windowMs: 60_000, max: 5 })

/** POST /api/auth/forgot-password — 3 tokens/min/IP (email-like abuse surface). */
export const forgotPasswordLimiter = createRateLimiter({
  name: 'auth:forgot-password',
  windowMs: 60_000,
  max: 3,
})

/** POST /api/auth/reset-password — 6 token redemptions/min/IP. */
export const resetPasswordLimiter = createRateLimiter({
  name: 'auth:reset-password',
  windowMs: 60_000,
  max: 6,
})
