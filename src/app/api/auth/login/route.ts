import { db } from '@/lib/db'
import { ACTIVITY_ACTIONS } from '@/lib/constants'
import { ApiError, handleApiError, logActivity, ok, parseBody } from '@/lib/api-utils'
import { createSession, toPublicUser, verifyPassword } from '@/lib/auth'
import { loginSchema } from '@/lib/schemas'
import { enforceRateLimit, loginLimiter } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    // Brute-force guard: 10 attempts/min/IP, successes and failures alike.
    enforceRateLimit(loginLimiter, request)

    const body = await parseBody(request, loginSchema)

    // Email is lowercased by loginSchema; registered emails are stored lowercase.
    const user = await db.user.findUnique({
      where: { email: body.email },
      include: {
        team: { select: { id: true, name: true } },
        room: { select: { id: true, roomCode: true, name: true } },
      },
    })
    if (!user || !verifyPassword(body.password, user.hashedPassword)) {
      throw new ApiError(401, 'Invalid email or password')
    }
    // Deactivated accounts still sign in: they land on onboarding and must
    // create a room or join one with a Room ID + password. Room-less accounts
    // cannot read or write any workspace data (requireRoomUser() 403 wall).
    // Joining or creating a room re-activates the account.

    await createSession(user.id, request.headers.get('user-agent'))
    await logActivity(user.id, ACTIVITY_ACTIONS.USER_LOGIN, { email: user.email })

    return ok({ user: toPublicUser(user) })
  } catch (error) {
    return handleApiError(error)
  }
}
