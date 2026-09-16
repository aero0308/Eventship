import { db } from '@/lib/db'
import { ACTIVITY_ACTIONS } from '@/lib/constants'
import { ApiError, handleApiError, logActivity, ok, parseBody, requireUser } from '@/lib/api-utils'
import { updateRoomSchema } from '@/lib/schemas'
import { roomDetailInclude, serializeRoom } from '@/lib/room'

/** Owner-only guard for a room the caller belongs to. */
async function requireOwnedRoom(roomId: string, userId: string) {
  const room = await db.room.findFirst({
    where: { id: roomId, isActive: true },
    include: roomDetailInclude,
  })
  if (!room) throw new ApiError(404, 'Not found in your event room')
  // Membership check: a non-member cannot even probe another room's existence.
  const membership = await db.user.findFirst({ where: { id: userId, roomId: room.id }, select: { id: true } })
  if (!membership) throw new ApiError(404, 'Not found in your event room')
  if (room.ownerId !== userId) throw new ApiError(403, 'Only the room owner can manage room settings')
  return room
}

/** GET /api/rooms/[roomId] — room detail; members only. */
export async function GET(_request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const user = await requireUser()
    const { roomId } = await params
    const room = await db.room.findFirst({ where: { id: roomId, isActive: true }, include: roomDetailInclude })
    if (!room || room.id !== user.roomId) throw new ApiError(404, 'Not found in your event room')
    return ok({ room: serializeRoom(room) })
  } catch (error) {
    return handleApiError(error)
  }
}

/** PUT /api/rooms/[roomId] — owner-only profile updates (name, description). */
export async function PUT(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const user = await requireUser()
    const { roomId } = await params
    const room = await requireOwnedRoom(roomId, user.id)
    const body = await parseBody(request, updateRoomSchema)

    const updated = await db.room.update({
      where: { id: room.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
      },
      include: roomDetailInclude,
    })
    await logActivity(user.id, ACTIVITY_ACTIONS.ROOM_UPDATED, { roomName: updated.name }, room.id)
    return ok({ room: serializeRoom(updated) })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * DELETE /api/rooms/[roomId] — owner-only. Removes the room and ALL room
 * data (teams → events → tasks → comments, activity). Every member (the
 * owner included) drops back to pending-onboarding. This cannot be undone.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const user = await requireUser()
    const { roomId } = await params
    const room = await requireOwnedRoom(roomId, user.id)

    await db.$transaction(async (tx) => {
      await tx.taskComment.deleteMany({ where: { roomId: room.id } })
      await tx.task.deleteMany({ where: { roomId: room.id } })
      await tx.event.deleteMany({ where: { roomId: room.id } })
      await tx.team.deleteMany({ where: { roomId: room.id } })
      await tx.activityLog.deleteMany({ where: { roomId: room.id } })
      await tx.user.updateMany({ where: { roomId: room.id }, data: { roomId: null } })
      await tx.room.delete({ where: { id: room.id } })
    })

    // Not room-stamped — the room no longer exists; keep an audit trace on the actor.
    await logActivity(user.id, ACTIVITY_ACTIONS.ROOM_DELETED, { roomName: room.name, roomCode: room.roomCode })
    return ok({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}
