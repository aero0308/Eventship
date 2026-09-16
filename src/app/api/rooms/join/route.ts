import { db } from '@/lib/db'
import { ACTIVITY_ACTIONS } from '@/lib/constants'
import { ApiError, handleApiError, logActivity, ok, parseBody, requireUser } from '@/lib/api-utils'
import { verifyPassword } from '@/lib/auth'
import { joinRoomSchema } from '@/lib/schemas'
import { enforceRateLimit, joinRoomLimiter } from '@/lib/rate-limit'
import { roomDetailInclude, serializeRoom } from '@/lib/room'

/**
 * POST /api/rooms/join — join an existing room with room_code + password.
 * Validates: code exists, room active, password matches, not full, not already
 * a member. Joins as a member (role unchanged).
 */
export async function POST(request: Request) {
  try {
    enforceRateLimit(joinRoomLimiter, request)

    const user = await requireUser()
    if (user.roomId) {
      throw new ApiError(409, 'You already belong to an event room. Leave it before joining another.')
    }

    const body = await parseBody(request, joinRoomSchema)

    const room = await db.room.findUnique({
      where: { roomCode: body.roomCode },
      include: { ...roomDetailInclude, _count: { select: { members: true } } },
    })
    // Uniform error for unknown code / wrong password / inactive room —
    // never disclose which part failed.
    if (!room || !room.isActive || !verifyPassword(body.password, room.passwordHash)) {
      throw new ApiError(401, 'Invalid Room ID or Password')
    }
    if (room.maxMembers !== null && room._count.members >= room.maxMembers) {
      throw new ApiError(409, 'This room is full — ask the owner to raise the member limit')
    }

    await db.user.update({ where: { id: user.id }, data: { roomId: room.id } })
    await logActivity(user.id, ACTIVITY_ACTIONS.ROOM_JOINED, { roomName: room.name, roomCode: room.roomCode }, room.id)

    const full = await db.room.findUniqueOrThrow({ where: { id: room.id }, include: roomDetailInclude })
    return ok({ room: serializeRoom(full) })
  } catch (error) {
    return handleApiError(error)
  }
}
