import { db } from '@/lib/db'
import { ACTIVITY_ACTIONS } from '@/lib/constants'
import { ApiError, handleApiError, logActivity, ok, parseBody, requireUser } from '@/lib/api-utils'
import { hashPassword } from '@/lib/auth'
import { regenerateRoomPasswordSchema } from '@/lib/schemas'
import { generateRoomPassword, roomDetailInclude, serializeRoom } from '@/lib/room'

/**
 * POST /api/rooms/regenerate-password — owner-only. Sets a new room join
 * password. Omit `password` to auto-generate one. The plaintext is returned
 * exactly once in this response (only the hash is stored).
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser()
    if (!user.roomId) throw new ApiError(403, 'Onboarding required — join or create an event room first')

    const room = await db.room.findFirst({ where: { id: user.roomId, isActive: true }, include: roomDetailInclude })
    if (!room) throw new ApiError(403, 'Your event room is no longer available. Please join or create a room.')
    if (room.ownerId !== user.id) {
      throw new ApiError(403, 'Only the room owner can manage room settings')
    }

    const body = await parseBody(request, regenerateRoomPasswordSchema)
    const roomPassword = body.password ?? generateRoomPassword()

    const updated = await db.room.update({
      where: { id: room.id },
      data: { passwordHash: hashPassword(roomPassword) },
      include: roomDetailInclude,
    })
    await logActivity(user.id, ACTIVITY_ACTIONS.ROOM_PASSWORD_REGENERATED, {}, room.id)
    return ok({ room: serializeRoom(updated), roomPassword })
  } catch (error) {
    return handleApiError(error)
  }
}
