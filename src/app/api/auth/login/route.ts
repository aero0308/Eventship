import { db } from '@/lib/db'
import { ACTIVITY_ACTIONS } from '@/lib/constants'
import { ApiError, handleApiError, logActivity, ok, parseBody } from '@/lib/api-utils'
import { createSession, toPublicUser, verifyPassword } from '@/lib/auth'
import { loginSchema } from '@/lib/schemas'

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, loginSchema)

    // Email is lowercased by loginSchema; registered emails are stored lowercase.
    const user = await db.user.findUnique({
      where: { email: body.email },
      include: { team: { select: { id: true, name: true } } },
    })
    if (!user || !verifyPassword(body.password, user.hashedPassword)) {
      throw new ApiError(401, 'Invalid email or password')
    }
    if (!user.isActive) throw new ApiError(401, 'Account is deactivated')

    await createSession(user.id, request.headers.get('user-agent'))
    await logActivity(user.id, ACTIVITY_ACTIONS.USER_LOGIN, { email: user.email })

    return ok({ user: toPublicUser(user) })
  } catch (error) {
    return handleApiError(error)
  }
}
