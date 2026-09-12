import { ApiClientError } from '@/lib/api-client'

/**
 * Client-side error → human message mapper (Testing & Polish phase).
 * Keeps catch blocks consistent: every surface shows the same tone and never
 * leaks stack traces or raw internals to the user.
 */
export function describeError(error: unknown): string {
  if (error instanceof ApiClientError) {
    // The server message is already user-facing ("Invalid due date: …").
    return error.message
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'Request cancelled.'
  }
  if (error instanceof TypeError) {
    // fetch() network failures surface as TypeError in browsers.
    return 'Network error — please check your connection and try again.'
  }
  if (error instanceof Error) {
    // Known Prisma/DB leaks are unlikely client-side, but keep the guard.
    if (error.message.includes('Unique constraint')) {
      return 'A record with these values already exists.'
    }
    return error.message || 'Something went wrong. Please try again.'
  }
  if (typeof error === 'string' && error.trim()) {
    return error
  }
  return 'Something went wrong. Please try again.'
}
