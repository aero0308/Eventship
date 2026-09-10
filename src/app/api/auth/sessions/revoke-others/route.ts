import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { handleApiError, logActivity, ok, requireUser } from '@/lib/api-utils'
import { SESSION_COOKIE } from '@/lib/constants'

/**
 * POST /api/auth/sessions/revoke-others
 * Sign out every device EXCEPT the current one. Returns the revoked count.
 */
export async function POST() {
  try {
    const user = await requireUser()

    const cookieStore = await cookies()
    const currentToken = cookieStore.get(SESSION_COOKIE)?.value ?? null

    const result = await db.session.deleteMany({
      where: {
        userId: user.id,
        ...(currentToken ? { token: { not: currentToken } } : {}),
      },
    })

    if (result.count > 0) {
      void logActivity(user.id, 'SESSIONS_REVOKED_OTHERS', { count: result.count })
    }

    return ok({ success: true, revoked: result.count })
  } catch (error) {
    return handleApiError(error)
  }
}
