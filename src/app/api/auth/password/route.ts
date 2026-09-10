import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { handleApiError, ok, parseBody, requireUser, ApiError, logActivity } from '@/lib/api-utils'
import { hashPassword, verifyPassword } from '@/lib/auth'
import { SESSION_COOKIE } from '@/lib/constants'
import { changePasswordSchema } from '@/lib/schemas'

/**
 * PATCH /api/auth/password
 * Change the signed-in user's password. Verifies the current password,
 * rehashes with scrypt, and revokes every OTHER session (current one stays alive).
 */
export async function PATCH(request: Request) {
  try {
    const user = await requireUser()
    const { currentPassword, newPassword } = await parseBody(request, changePasswordSchema)

    if (!verifyPassword(currentPassword, user.hashedPassword)) {
      throw new ApiError(400, 'Current password is incorrect.')
    }
    if (verifyPassword(newPassword, user.hashedPassword)) {
      throw new ApiError(400, 'The new password must be different from the current one.')
    }

    await db.user.update({
      where: { id: user.id },
      data: { hashedPassword: hashPassword(newPassword) },
    })

    // Revoke all other sessions; keep the current device signed in.
    const cookieStore = await cookies()
    const currentToken = cookieStore.get(SESSION_COOKIE)?.value ?? null
    await db.session.deleteMany({
      where: { userId: user.id, ...(currentToken ? { token: { not: currentToken } } : {}) },
    })

    void logActivity(user.id, 'PASSWORD_CHANGED')

    return ok({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
