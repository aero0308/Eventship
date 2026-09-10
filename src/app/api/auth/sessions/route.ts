import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { handleApiError, ok, requireUser } from '@/lib/api-utils'
import { SESSION_COOKIE } from '@/lib/constants'

/**
 * GET /api/auth/sessions
 * Active session manager for the profile page: lists the signed-in user's
 * live sessions (expired rows are pruned first) and flags the current one.
 */
export async function GET() {
  try {
    const user = await requireUser()

    // Prune expired sessions so the list only shows live ones.
    await db.session.deleteMany({
      where: { userId: user.id, expiresAt: { lt: new Date() } },
    })

    const cookieStore = await cookies()
    const currentToken = cookieStore.get(SESSION_COOKIE)?.value ?? null

    const sessions = await db.session.findMany({
      where: { userId: user.id },
      orderBy: [{ lastSeenAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        lastSeenAt: true,
        userAgent: true,
        token: true,
      },
    })

    return ok({
      sessions: sessions.map((session) => ({
        id: session.id,
        createdAt: session.createdAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        lastSeenAt: session.lastSeenAt.toISOString(),
        userAgent: session.userAgent,
        isCurrent: currentToken !== null && session.token === currentToken,
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
