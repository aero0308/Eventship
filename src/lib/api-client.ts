/**
 * Typed fetch wrapper for the EventFlow API.
 * - Base path: /api
 * - Sends/receives JSON, includes session cookie (credentials: 'include').
 * - Non-2xx responses throw ApiClientError with the server-provided message.
 */

import { API_BASE } from '@/lib/constants'

export class ApiClientError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
  }
}

type QueryValue = string | number | boolean | null | undefined

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      credentials: 'include',
      cache: 'no-store',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiClientError(0, 'Network error — please check your connection and try again.')
  }

  let data: unknown = null
  const text = await response.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    const message =
      isRecord(data) && typeof data['error'] === 'string'
        ? data['error']
        : `Request failed with status ${response.status}`
    // Session died server-side (expired, revoked, deactivation): tell the app so it
    // can reset the auth store and bounce to login. Auth endpoints are excluded —
    // login/register/me handle their own 401s.
    if (response.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(new CustomEvent('ems:unauthorized', { detail: { message } }))
    }
    throw new ApiClientError(response.status, message)
  }

  return data as T
}

/** Build a query string from a filter object (skips empty values). */
export function qs(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }
  const encoded = search.toString()
  return encoded ? `?${encoded}` : ''
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { method: 'GET', signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
