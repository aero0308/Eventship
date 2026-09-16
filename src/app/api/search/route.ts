import { db } from '@/lib/db'
import { handleApiError, ok } from '@/lib/api-utils'
import { requireRoomUser } from '@/lib/room'

/**
 * GET /api/search?q=<term>
 * Cross-entity quick search used by the global command palette (⌘K).
 * Returns a small preview for each entity group (events, tasks, teams, users).
 * SQLite `contains` matching is case-insensitive for ASCII text.
 */
export async function GET(request: Request) {
  try {
    const { roomId } = await requireRoomUser()
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') ?? '').trim()

    if (q.length < 2) {
      return ok({ events: [], tasks: [], teams: [], users: [] })
    }

    // Every group is room-scoped — search can never surface another tenant.
    const [events, tasks, teams, users] = await Promise.all([
      db.event.findMany({
        where: {
          roomId,
          OR: [{ name: { contains: q } }, { description: { contains: q } }],
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { id: true, name: true, status: true, startDate: true },
      }),
      db.task.findMany({
        where: { roomId, title: { contains: q } },
        orderBy: { updatedAt: 'desc' },
        take: 6,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          eventId: true,
          event: { select: { name: true } },
        },
      }),
      db.team.findMany({
        where: { roomId, name: { contains: q } },
        orderBy: { name: 'asc' },
        take: 4,
        select: { id: true, name: true },
      }),
      db.user.findMany({
        where: {
          roomId,
          isActive: true,
          OR: [{ fullName: { contains: q } }, { email: { contains: q } }],
        },
        orderBy: { fullName: 'asc' },
        take: 4,
        select: { id: true, fullName: true, role: true },
      }),
    ])

    return ok({
      events: events.map((e) => ({ ...e, startDate: e.startDate.toISOString() })),
      tasks: tasks.map((t) => ({ ...t, eventName: t.event?.name ?? null })),
      teams,
      users,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
