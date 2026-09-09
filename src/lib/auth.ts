import 'server-only'
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { SESSION_COOKIE } from '@/lib/constants'

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const KEY_LEN = 64

/** Hash a plaintext password with scrypt: returns "salt:hash" hex string. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, KEY_LEN).toString('hex')
  return `${salt}:${derived}`
}

/** Constant-time verification of a plaintext password against a stored hash. */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const expected = Buffer.from(hash, 'hex')
  const actual = scryptSync(password, salt, KEY_LEN)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

/** Create a DB session row and set the httpOnly session cookie. */
export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await db.session.create({ data: { token, userId, expiresAt } })
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
  return token
}

/** Resolve the current authenticated user from the session cookie, or null. */
export async function getSessionUser() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value
    if (!token) return null
    const session = await db.session.findUnique({
      where: { token },
      include: {
        user: { include: { team: { select: { id: true, name: true } } } },
      },
    })
    if (!session) return null
    if (session.expiresAt < new Date()) {
      await db.session.delete({ where: { id: session.id } }).catch(() => undefined)
      return null
    }
    if (!session.user.isActive) return null
    return session.user
  } catch {
    return null
  }
}

/** Delete the current session (if any) and clear the cookie. */
export async function destroySession(): Promise<void> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value
    if (token) {
      await db.session.deleteMany({ where: { token } })
    }
    cookieStore.delete(SESSION_COOKIE)
  } catch {
    // ignore
  }
}

/** Public shape of a user returned by the API (never leaks hashedPassword). */
export function toPublicUser(user: {
  id: string
  email: string
  fullName: string
  role: string
  isActive: boolean
  teamId: string | null
  team?: { id: string; name: string } | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    teamId: user.teamId,
    team: user.team ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}
