import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { handleApiError, logActivity, ok, parseBody } from '@/lib/api-utils'
import { forgotPasswordSchema } from '@/lib/schemas'

/**
 * POST /api/auth/forgot-password
 * Always answers 200 so the endpoint can't be used to enumerate accounts.
 * There is no SMTP provider in this sandbox — when a matching user exists the
 * freshly minted reset link is returned as `demoResetUrl` (an explicit demo
 * stand-in for the transactional email) and logged to the server console.
 */
export async function POST(request: Request) {
  try {
    const { email } = await parseBody(request, forgotPasswordSchema)

    const user = await db.user.findUnique({ where: { email } })
    let demoResetUrl: string | undefined

    if (user && user.isActive) {
      // A user only ever has one live reset token — issuing a new one
      // invalidates any previous (unused) request.
      await db.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } })

      const token = randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      await db.passwordResetToken.create({ data: { token, userId: user.id, expiresAt } })

      demoResetUrl = `/#/reset-password?token=${token}`
      console.log(`[auth] password reset requested for ${email} — demo link: ${demoResetUrl}`)
      void logActivity(user.id, 'PASSWORD_RESET_REQUESTED', { email })
    }

    return ok({
      success: true,
      message: 'If an account exists for that email, a password reset link has been created.',
      ...(demoResetUrl ? { demoResetUrl } : {}),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
