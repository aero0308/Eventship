import { db } from '@/lib/db'
import { handleApiError, ok, parseBody, requireUser } from '@/lib/api-utils'
import { toPublicUser } from '@/lib/auth'
import { updateSelfSchema } from '@/lib/schemas'

export async function GET() {
  try {
    const user = await requireUser()
    return ok({ user: toPublicUser(user) })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * PATCH — self-service updates for the signed-in user (workflow preferences,
 * profile photo, cover background). Role/team/active stay admin-managed
 * (see /api/users/[id]).
 */
export async function PATCH(request: Request) {
  try {
    const user = await requireUser()
    const body = await parseBody(request, updateSelfSchema)
    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        ...(body.strictDependencyGuard !== undefined
          ? { strictDependencyGuard: body.strictDependencyGuard }
          : {}),
        ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
        ...(body.profileBg !== undefined ? { profileBg: body.profileBg } : {}),
      },
      include: {
        team: { select: { id: true, name: true } },
        room: { select: { id: true, roomCode: true, name: true } },
      },
    })
    return ok({ user: toPublicUser(updated) })
  } catch (error) {
    return handleApiError(error)
  }
}
