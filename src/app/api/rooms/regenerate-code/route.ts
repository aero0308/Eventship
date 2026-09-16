import { db } from '@/lib/db'
import { ACTIVITY_ACTIONS } from '@/lib/constants'
import { ApiError, handleApiError, logActivity, ok, requireUser } from '@/lib/api-utils'
import { generateUniqueRoomCode, roomDetailInclude, serializeRoom } from '@/lib/room'

/**
 * POST /api/rooms/regenerate-code — owner-only. Issues a fresh share code;
 * the old code stops working for new joins immediately.
 */
export async function POST() {
  try {
    const user = await requireUser()
    if (!user.roomId) throw new ApiError(403, 'Onboarding required — join or create an event room first')

    const room = await db.room.findFirst({ where: { id: user.roomId, isActive: true }, include: roomDetailInclude })
    if (!room) throw new ApiError(403, 'Your event room is no longer available. Please join or create a room.')
    if (room.ownerId !== user.id) {
      throw new ApiError(403, 'Only the room owner can manage room settings')
    }

    const roomCode = await generateUniqueRoomCode()
    const updated = await db.room.update({ where: { id: room.id }, data: { roomCode }, include: roomDetailInclude })
    await logActivity(user.id, ACTIVITY_ACTIONS.ROOM_CODE_REGENERATED, { roomCode }, room.id)
    return ok({ room: serializeRoom(updated) })
  } catch (error) {
    return handleApiError(error)
  }
}
