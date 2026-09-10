import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { ApiError, handleApiError, logActivity, ok, requireUser } from '@/lib/api-utils'
import { SESSION_COOKIE } from '@/lib/constants'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * DELETE /api/auth/sessions/[id]
 * Revoke one of the signed-in user's own sessions. Revoking the CURRENT
 * session also clears the cookie — the client treats that like a sign-out.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser()
    const { id } = await context.params

    const session = await db.session.findUnique({ where: { id } })
    if (!session || session.userId !== user.id) {
      throw new ApiError(404, 'Session not found')
    }

    await db.session.delete({ where: { id } })
    void logActivity(user.id, 'SESSION_REVOKED', { sessionId: id })

    const cookieStore = await cookies()
    const currentToken = cookieStore.get(SESSION_COOKIE)?.value ?? null
    const wasCurrent = currentToken !== null && session.token === currentToken

    if (wasCurrent) {
      cookieStore.delete(SESSION_COOKIE)
    }

    return ok({ success: true, revokedCurrent: wasCurrent })
  } catch (error) {
    return handleApiError(error)
  }
}
