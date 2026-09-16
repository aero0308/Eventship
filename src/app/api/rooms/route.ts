import { db } from '@/lib/db'
import { ACTIVITY_ACTIONS } from '@/lib/constants'
import { ApiError, handleApiError, logActivity, ok, parseBody, requireUser } from '@/lib/api-utils'
import { hashPassword } from '@/lib/auth'
import { createRoomSchema } from '@/lib/schemas'
import {
  generateUniqueRoomCode,
  roomDetailInclude,
  serializeRoom,
} from '@/lib/room'

/**
 * GET /api/rooms — the current user's room (room + members).
 * 403 with "Onboarding required" when the user has no room yet.
 */
export async function GET() {
  try {
    const user = await requireUser()
    if (!user.roomId) {
      throw new ApiError(403, 'Onboarding required — join or create an event room first')
    }
    const room = await db.room.findFirst({
      where: { id: user.roomId, isActive: true },
      include: {
        ...roomDetailInclude,
        members: {
          where: { isActive: true },
          select: { id: true, fullName: true, email: true, role: true, teamId: true },
          orderBy: { fullName: 'asc' },
        },
      },
    })
    if (!room) throw new ApiError(403, 'Your event room is no longer available. Please join or create a room.')
    return ok({ room: { ...serializeRoom(room), members: room.members } })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/rooms — create a new isolated room. The caller becomes the owner
 * and is promoted to EVENT_MANAGER. Only allowed while room-less (onboarding).
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser()
    if (user.roomId) {
      throw new ApiError(409, 'You already belong to an event room. Leave it before creating a new one.')
    }

    const body = await parseBody(request, createRoomSchema)
    const roomCode = await generateUniqueRoomCode()

    const room = await db.$transaction(async (tx) => {
      const created = await tx.room.create({
        data: {
          roomCode,
          name: body.name,
          description: body.description ?? null,
          passwordHash: hashPassword(body.password),
          ownerId: user.id,
        },
      })
      await tx.user.update({
        where: { id: user.id },
        data: { roomId: created.id, role: 'EVENT_MANAGER' },
      })
      return created
    })

    await logActivity(user.id, ACTIVITY_ACTIONS.ROOM_CREATED, { roomName: room.name, roomCode }, room.id)

    const full = await db.room.findUniqueOrThrow({ where: { id: room.id }, include: roomDetailInclude })
    return ok({ room: serializeRoom(full) }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
