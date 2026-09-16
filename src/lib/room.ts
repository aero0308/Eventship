import 'server-only'
import { db } from '@/lib/db'
import { ApiError, requireUser } from '@/lib/api-utils'
import type { Room, User } from '@prisma/client'

/*
 * Multi-tenant room helpers — the equivalent of the spec's get_current_room
 * dependency. Every data endpoint resolves its tenant context through
 * requireRoomUser(); users without a room are held at the onboarding gate.
 */

/** Unambiguous alphabet for share codes: no O/0/I/1 (EVT-7X9K2M style). */
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateRoomCode(): string {
  let suffix = ''
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  for (const byte of bytes) suffix += ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]
  return `EVT-${suffix}`
}

/** Generate a code that is guaranteed unique in the rooms table. */
export async function generateUniqueRoomCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateRoomCode()
    const existing = await db.room.findUnique({ where: { roomCode: code }, select: { id: true } })
    if (!existing) return code
  }
  // Astronomically unlikely (32^6 ≈ 1e9); fail loudly rather than loop forever.
  throw new ApiError(500, 'Could not allocate a unique room code, please retry')
}

/** Random join password (used when an owner regenerates without picking one). */
export function generateRoomPassword(): string {
  const bytes = new Uint8Array(10)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]).join('')
}

/**
 * Require a signed-in user who has completed room onboarding.
 * Returns the user AND their tenant room. 403 (not 401) when authenticated
 * but room-less — the frontend routes them to the onboarding screen.
 */
export async function requireRoomUser(): Promise<{ user: User; roomId: string; room: Room }> {
  const user = await requireUser()
  if (!user.roomId) {
    throw new ApiError(403, 'Onboarding required — join or create an event room first')
  }
  const room = await db.room.findUnique({ where: { id: user.roomId } })
  if (!room || !room.isActive) {
    throw new ApiError(403, 'Your event room is no longer available. Please join or create a room.')
  }
  return { user, roomId: user.roomId, room }
}

/** Assert the given user ids all belong to the caller's room (team/event assignment safety). */
export async function assertUsersInRoom(userIds: string[], roomId: string, message = 'One or more users are not in your event room'): Promise<void> {
  if (userIds.length === 0) return
  const found = await db.user.findMany({
    where: { id: { in: userIds }, roomId },
    select: { id: true },
  })
  if (found.length !== new Set(userIds).size) {
    throw new ApiError(403, message)
  }
}

/** Fetch a room-scoped row or throw a uniform 404 (never leaks existence). */
export async function findRoomScoped<T>(
  finder: (where: { id: string; roomId: string }) => Promise<T | null>,
  id: string,
  roomId: string
): Promise<T> {
  const row = await finder({ id, roomId })
  if (!row) throw new ApiError(404, 'Not found in your event room')
  return row
}

/** Public shape of a room (never leaks passwordHash). */
export function serializeRoom(
  room: Room & {
    owner?: { id: string; fullName: string; email: string } | null
    _count?: { members: number }
  }
) {
  return {
    id: room.id,
    roomCode: room.roomCode,
    name: room.name,
    description: room.description,
    ownerId: room.ownerId,
    owner: room.owner ?? null,
    isActive: room.isActive,
    maxMembers: room.maxMembers,
    memberCount: room._count?.members ?? null,
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
  }
}

export const roomDetailInclude = {
  owner: { select: { id: true, fullName: true, email: true } },
  _count: { select: { members: true } },
} as const
