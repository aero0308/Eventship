/**
 * One-time data migration for the multi-tenant room system.
 * Run with:  bun prisma/migrate-rooms.ts
 *
 * Strategy = spec "Option A" (no disruption):
 *  1. Ensure a Default Room exists (owner = first active EVENT_MANAGER, else
 *     admin@eventship.io). Its join password is fixed and printed here.
 *  2. Assign EVERY room-less user to the Default Room.
 *  3. Backfill denormalized room ids: teams (manager/member room), events
 *     (team room), tasks (event room), comments (task room), activity
 *     (actor room) — falling back to the Default Room.
 *
 * Idempotent: re-running is a no-op when everything already carries a room.
 */
import { PrismaClient } from '@prisma/client'
import { randomBytes, scryptSync } from 'crypto'

const prisma = new PrismaClient()

const DEFAULT_ROOM_PASSWORD = 'demo1234' // printed below; owners can regenerate in Room Settings

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${derived}`
}

function generateRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let suffix = ''
  for (let i = 0; i < 6; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return `EVT-${suffix}`
}

async function main() {
  console.log('🏷️  Room migration starting...')

  // ---- 1. Ensure the Default Room ----------------------------------------
  let defaultRoom = await prisma.room.findFirst({ where: { name: { contains: 'Default' } } })
  if (!defaultRoom) {
    const owner =
      (await prisma.user.findFirst({ where: { role: 'EVENT_MANAGER', isActive: true }, orderBy: { createdAt: 'asc' } })) ??
      (await prisma.user.findFirst({ where: { email: 'admin@eventship.io' } })) ??
      (await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } }))
    if (!owner) {
      console.log('   No users found — nothing to migrate.')
      return
    }
    let roomCode = generateRoomCode()
    // Guarantee uniqueness.
    for (let i = 0; i < 10; i += 1) {
      const clash = await prisma.room.findUnique({ where: { roomCode } })
      if (!clash) break
      roomCode = generateRoomCode()
    }
    defaultRoom = await prisma.room.create({
      data: {
        roomCode,
        name: 'Eventship HQ (Default Room)',
        description:
          'Auto-created migration room. Every pre-existing account was placed here — share the Room ID + password to let teammates join, or delete this room from Room Settings once everyone has a home.',
        passwordHash: hashPassword(DEFAULT_ROOM_PASSWORD),
        ownerId: owner.id,
      },
    })
    console.log(`   Created Default Room "${defaultRoom.name}" (code ${defaultRoom.roomCode}, password ${DEFAULT_ROOM_PASSWORD})`)
  } else {
    console.log(`   Default Room already exists: "${defaultRoom.name}" (${defaultRoom.roomCode})`)
  }
  const defaultRoomId = defaultRoom.id

  // ---- 2. Room-less users → Default Room ----------------------------------
  const orphanUsers = await prisma.user.updateMany({
    where: { roomId: null },
    data: { roomId: defaultRoomId },
  })
  console.log(`   Assigned ${orphanUsers.count} user(s) to the Default Room`)

  // ---- 3. Backfill denormalized room ids ----------------------------------
  const teams = await prisma.team.updateMany({
    where: { roomId: null },
    data: { roomId: defaultRoomId },
  })
  console.log(`   Backfilled ${teams.count} team(s)`)

  const events = await prisma.event.updateMany({
    where: { roomId: null },
    data: { roomId: defaultRoomId },
  })
  console.log(`   Backfilled ${events.count} event(s)`)

  const tasks = await prisma.task.updateMany({
    where: { roomId: null },
    data: { roomId: defaultRoomId },
  })
  console.log(`   Backfilled ${tasks.count} task(s)`)

  const comments = await prisma.taskComment.updateMany({
    where: { roomId: null },
    data: { roomId: defaultRoomId },
  })
  console.log(`   Backfilled ${comments.count} comment(s)`)

  const activities = await prisma.activityLog.updateMany({
    where: { roomId: null },
    data: { roomId: defaultRoomId },
  })
  console.log(`   Backfilled ${activities.count} activity log row(s)`)

  console.log('✅ Room migration complete.')
  console.log(`   Default Room join code: ${defaultRoom.roomCode} / password: ${DEFAULT_ROOM_PASSWORD}`)
}

main()
  .catch((e) => {
    console.error('❌ Room migration failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
