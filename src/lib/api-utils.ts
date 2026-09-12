import 'server-only'
import { NextResponse } from 'next/server'
import { ZodError, type ZodType } from 'zod'
import { getSessionUser } from '@/lib/auth'
import { RateLimitError } from '@/lib/rate-limit'
import type { User } from '@prisma/client'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

/** Require an authenticated user; throws ApiError(401) when missing. */
export async function requireUser(): Promise<User> {
  const user = await getSessionUser()
  if (!user) throw new ApiError(401, 'Not authenticated. Please log in.')
  return user
}

/** Parse + validate a JSON body with a Zod schema; throws ApiError(400) on invalid input. */
export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    const first = result.error.issues[0]
    const field = first?.path?.join('.') ?? 'body'
    throw new ApiError(400, `Invalid ${field}: ${first?.message ?? 'validation failed'}`)
  }
  return result.data
}

/** Uniform error mapping for all route handlers. */
export function handleApiError(error: unknown) {
  if (error instanceof RateLimitError) {
    return NextResponse.json(
      { error: error.message },
      { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } }
    )
  }
  if (error instanceof ApiError) {
    return fail(error.message, error.status)
  }
  if (error instanceof ZodError) {
    const first = error.issues[0]
    return fail(first?.message ?? 'Validation failed', 400)
  }
  const message = error instanceof Error ? error.message : 'Internal server error'
  if (message.includes('Unique constraint')) {
    return fail('A record with these unique values already exists', 409)
  }
  if (message.includes('Foreign key constraint')) {
    return fail('Referenced record does not exist', 404)
  }
  console.error('[api-error]', error)
  return fail('Internal server error', 500)
}

/** Fire-and-forget activity log writer. Never throws. */
export async function logActivity(
  userId: string,
  action: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await (await import('@/lib/db')).db.activityLog.create({
      data: { userId, action, details: details ? JSON.stringify(details) : null },
    })
  } catch (e) {
    console.error('[activity-log]', e)
  }
}

/**
 * Read a user's notification mute map. Missing key/field = enabled.
 * Never throws — a malformed stored value simply means "default (on)".
 */
export async function getNotificationPrefs(userId: string): Promise<Record<string, boolean>> {
  try {
    const user = await (await import('@/lib/db')).db.user.findUnique({
      where: { id: userId },
      select: { notificationPrefs: true },
    })
    if (!user?.notificationPrefs) return {}
    const parsed = JSON.parse(user.notificationPrefs)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, boolean>
    }
    return {}
  } catch {
    return {}
  }
}

/** Fire-and-forget notification creator. Respects the recipient's per-type mute map. Never throws. */
export async function notifyUser(
  userId: string,
  type: string,
  message: string
): Promise<void> {
  try {
    const prefs = await getNotificationPrefs(userId)
    if (prefs[type] === false) return // muted by the recipient
    const { db } = await import('@/lib/db')
    await db.notification.create({
      data: { userId, type, message },
    })
    // Live-push to the recipient's personal room (best-effort; realtime
    // service may be offline — polling remains the fallback). The message
    // rides the payload so clients can toast it without a refetch (Phase 7).
    const { emitRealtime } = await import('@/lib/realtime')
    await emitRealtime({ room: `user:${userId}`, event: 'notification:new', data: { userId, type, message } })
  } catch (e) {
    console.error('[notify]', e)
  }
}
