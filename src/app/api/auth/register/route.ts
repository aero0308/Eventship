import { db } from '@/lib/db'
import { ACTIVITY_ACTIONS } from '@/lib/constants'
import { ApiError, handleApiError, logActivity, ok, parseBody } from '@/lib/api-utils'
import { createSession, hashPassword, toPublicUser } from '@/lib/auth'
import { registerSchema } from '@/lib/schemas'
import { enforceRateLimit, registerLimiter } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    // Account-creation flood guard: 5 registrations/min/IP.
    enforceRateLimit(registerLimiter, request)

    const body = await parseBody(request, registerSchema)

    const existing = await db.user.findUnique({ where: { email: body.email } })
    if (existing) throw new ApiError(409, 'An account with this email already exists')

    // Multi-tenant contract: self-registered users are ALWAYS members pending
    // onboarding. Role is granted at onboarding (create room → EVENT_MANAGER,
    // join room → member) or later by a room admin via /api/users/[id];
    // teamId cannot be chosen before a room exists.
    const user = await db.user.create({
      data: {
        email: body.email,
        fullName: body.fullName,
        hashedPassword: hashPassword(body.password),
        role: 'EMPLOYEE',
        teamId: null,
      },
      include: {
        team: { select: { id: true, name: true } },
        room: { select: { id: true, roomCode: true, name: true } },
      },
    })

    await createSession(user.id, request.headers.get('user-agent'))
    await logActivity(user.id, ACTIVITY_ACTIONS.USER_REGISTERED, { email: user.email })

    return ok({ user: toPublicUser(user) }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
