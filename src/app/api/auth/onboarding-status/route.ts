import { db } from '@/lib/db'
import { handleApiError, ok, requireUser } from '@/lib/api-utils'

/**
 * GET /api/auth/onboarding-status — onboarding gate probe.
 * { needsOnboarding: true } until the user has joined/created a room.
 */
export async function GET() {
  try {
    const user = await requireUser()
    const room = user.roomId
      ? await db.room.findUnique({
          where: { id: user.roomId },
          select: { id: true, roomCode: true, name: true },
        })
      : null
    return ok({
      needsOnboarding: !room,
      roomId: room?.id ?? null,
      room,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
