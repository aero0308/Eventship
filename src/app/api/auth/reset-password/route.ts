import { db } from '@/lib/db'
import { ApiError, handleApiError, logActivity, ok, parseBody } from '@/lib/api-utils'
import { hashPassword } from '@/lib/auth'
import { resetPasswordSchema } from '@/lib/schemas'
import { enforceRateLimit, resetPasswordLimiter } from '@/lib/rate-limit'

/**
 * POST /api/auth/reset-password
 * Consumes a single-use, unexpired reset token, upgrades the password hash and
 * revokes every session for the user (all devices must sign in again).
 */
export async function POST(request: Request) {
  try {
    // Token-redemption flood guard: 6 attempts/min/IP.
    enforceRateLimit(resetPasswordLimiter, request)

    const { token, newPassword } = await parseBody(request, resetPasswordSchema)

    const reset = await db.passwordResetToken.findUnique({
      where: { token },
      include: { user: { select: { id: true, isActive: true, email: true } } },
    })
    if (!reset || reset.usedAt) {
      throw new ApiError(400, 'This reset link is invalid or has already been used.')
    }
    if (reset.expiresAt < new Date()) {
      throw new ApiError(400, 'This reset link has expired — please request a new one.')
    }
    if (!reset.user.isActive) {
      throw new ApiError(400, 'This account is deactivated and cannot reset its password.')
    }

    await db.$transaction([
      db.user.update({
        where: { id: reset.userId },
        data: { hashedPassword: hashPassword(newPassword) },
      }),
      db.passwordResetToken.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
      // Password changed → every existing session is untrustworthy.
      db.session.deleteMany({ where: { userId: reset.userId } }),
    ])

    void logActivity(reset.userId, 'PASSWORD_RESET', { email: reset.user.email })

    return ok({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
