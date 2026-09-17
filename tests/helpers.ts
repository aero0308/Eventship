/**
 * Shared helpers for the API integration suite (bun:test).
 *
 * The suite exercises the REAL HTTP surface of the running dev server
 * (TEST_BASE_URL, default http://localhost:3000) exactly like a consumer:
 * cookies are stored from Set-Cookie and replayed, and every client gets a
 * unique fake `x-forwarded-for` so the auth rate limiter buckets never
 * collide between tests.
 *
 * Run with the dev server up:  bun run test
 */

import { expect } from 'bun:test'

export const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

/** Seed accounts (prisma/seed.ts). */
export const MANAGER = { email: 'admin@eventship.io', password: 'password123' }
export const EMPLOYEE = { email: 'david@eventship.io', password: 'password123' }

let xffCounter = 0
export function newXff(): string {
  xffCounter += 1
  return `10.207.${xffCounter % 255}.${(Date.now() % 250) + 1}`
}

export function uniqueEmail(prefix = 'qa'): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@qa.eventship.io`
}

export interface ApiResponse<T = unknown> {
  status: number
  headers: Headers
  data: T
  /** Raw parsed body when JSON parsing fails (null). */
  raw: string
}

/** Minimal cookie-jar HTTP client scoped to one fake IP. */
export class TestClient {
  readonly xff: string
  private cookies = new Map<string, string>()

  constructor(xff: string = newXff()) {
    this.xff = xff
  }

  /** Remember every cookie the server sets (session lifecycle). */
  private absorbCookies(headers: Headers): void {
    const list =
      typeof headers.getSetCookie === 'function'
        ? headers.getSetCookie()
        : (headers.get('set-cookie')?.split(/,(?=[^;]+=[^;]+)/) ?? [])
    for (const cookie of list) {
      const [pair] = cookie.split(';')
      const eq = pair.indexOf('=')
      if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
    }
  }

  clearCookies(): void {
    this.cookies.clear()
  }

  hasSessionCookie(): boolean {
    return this.cookies.has('ems_session')
  }

  async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
    extraHeaders: Record<string, string> = {}
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'x-forwarded-for': this.xff,
      ...extraHeaders,
    }
    const cookie = [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
    if (cookie) headers.Cookie = cookie
    if (body !== undefined) headers['Content-Type'] = 'application/json'

    const res = await fetch(`${BASE_URL}/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    this.absorbCookies(res.headers)
    const raw = await res.text()
    let data: unknown = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }
    return { status: res.status, headers: res.headers, data: data as T, raw }
  }

  get<T>(path: string) {
    return this.request<T>('GET', path)
  }
  post<T>(path: string, body?: unknown) {
    return this.request<T>('POST', path, body)
  }
  patch<T>(path: string, body?: unknown) {
    return this.request<T>('PATCH', path, body)
  }
  put<T>(path: string, body?: unknown) {
    return this.request<T>('PUT', path, body)
  }
  del<T>(path: string) {
    return this.request<T>('DELETE', path)
  }

  /** POST with an arbitrary raw body (malformed-JSON tests). */
  async postRaw<T>(path: string, rawBody: string): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-forwarded-for': this.xff,
    }
    const cookie = [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
    if (cookie) headers.Cookie = cookie
    const res = await fetch(`${BASE_URL}/api${path}`, { method: 'POST', headers, body: rawBody })
    const raw = await res.text()
    let data: unknown = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }
    return { status: res.status, headers: res.headers, data: data as T, raw }
  }
}

/** Sign in through the real endpoint and return a cookie-carrying client. */
export async function loginAs(
  credentials: { email: string; password: string },
  xff?: string
): Promise<TestClient> {
  const client = new TestClient(xff)
  const res = await client.post<{ user: { email: string; role: string } }>('/auth/login', credentials)
  expect(res.status).toBe(200)
  expect(client.hasSessionCookie()).toBe(true)
  return client
}

/** Assert a JSON error body carries the expected substring. */
export function expectErrorContains(res: { data: unknown }, substring: string): void {
  const message = (res.data as { error?: string } | null)?.error ?? ''
  expect(message.toLowerCase()).toContain(substring.toLowerCase())
}

/** Clock jitter guard for CI cold starts — dev server may still be compiling. */
export async function waitForServer(timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown = null
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`)
      if (res.ok) return
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(
    `Dev server at ${BASE_URL} did not become ready within ${timeoutMs}ms (${String(lastError)})`
  )
}
