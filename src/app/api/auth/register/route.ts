import { db } from '@/lib/db'
import { ACTIVITY_ACTIONS } from '@/lib/constants'
import { ApiError, handleApiError, logActivity, ok, parseBody } from '@/lib/api-utils'
import { createSession, hashPassword, toPublicUser } from '@/lib/auth'
import { registerSchema } from '@/lib/schemas'

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, registerSchema)

    const existing = await db.user.findUnique({ where: { email: body.email } })
    if (existing) throw new ApiError(409, 'An account with this email already exists')

    if (body.teamId) {
      const team = await db.team.findUnique({ where: { id: body.teamId } })
      if (!team) throw new ApiError(404, 'Team not found')
    }

    const user = await db.user.create({
      data: {
        email: body.email,
        fullName: body.fullName,
        hashedPassword: hashPassword(body.password),
        role: body.role,
        teamId: body.teamId ?? null,
      },
      include: { team: { select: { id: true, name: true } } },
    })

    await createSession(user.id)
    await logActivity(user.id, ACTIVITY_ACTIONS.USER_REGISTERED, { email: user.email })

    return ok({ user: toPublicUser(user) }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
