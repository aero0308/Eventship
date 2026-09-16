import { db } from '@/lib/db'
import { handleApiError, ok } from '@/lib/api-utils'
import { requireRoomUser } from '@/lib/room'
import { serializeTask, taskInclude } from '../_lib/tasks'
import { eventInclude, serializeEvent } from '../_lib/events'
import type { Prisma } from '@prisma/client'

/** Extracts a `YYYY-MM` month key from a query param, or null when invalid. */
function parseMonthKey(raw: string | null): string | null {
  if (!raw) return null
  const match = /^(\d{4})-(\d{2})$/.exec(raw)
  if (!match) return null
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return raw
}

/**
 * GET /api/calendar?month=YYYY-MM[&teamId=…][&assignedTo=me|uuid]
 * Returns all tasks due inside the month + events overlapping it.
 */
export async function GET(request: Request) {
  try {
    const { user, roomId } = await requireRoomUser()
    const { searchParams } = new URL(request.url)

    const monthKey = parseMonthKey(searchParams.get('month')) ?? (() => {
      const now = new Date()
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    })()

    const [year, month] = monthKey.split('-').map(Number)
    const rangeStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0))
    const rangeEnd = new Date(Date.UTC(year, month, 1, 0, 0, 0)) // first day of next month

    const teamId = searchParams.get('teamId') || undefined
    const assignedTo = searchParams.get('assignedTo')

    const taskWhere: Prisma.TaskWhereInput = {
      roomId,
      dueDate: { gte: rangeStart, lt: rangeEnd },
      ...(teamId ? { event: { teamId } } : {}),
    }
    if (assignedTo === 'me') taskWhere.assignedTo = user.id
    else if (assignedTo === 'unassigned') taskWhere.assignedTo = null
    else if (assignedTo) taskWhere.assignedTo = assignedTo

    const eventWhere: Prisma.EventWhereInput = {
      roomId,
      // Overlap: starts before the month ends AND ends on/after the month starts.
      startDate: { lt: rangeEnd },
      endDate: { gte: rangeStart },
      ...(teamId ? { teamId } : {}),
    }

    const [tasks, events] = await Promise.all([
      db.task.findMany({
        where: taskWhere,
        orderBy: { dueDate: 'asc' },
        include: taskInclude,
      }),
      db.event.findMany({
        where: eventWhere,
        orderBy: { startDate: 'asc' },
        include: eventInclude,
      }),
    ])

    const serializedTasks = tasks.map(serializeTask)
    let completed = 0
    let overdue = 0
    for (const task of serializedTasks) {
      if (task.status === 'COMPLETED') completed += 1
      else if (task.dueDate && new Date(task.dueDate).getTime() < Date.now()) overdue += 1
    }

    return ok({
      month: monthKey,
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
      tasks: serializedTasks,
      events: events.map((event) => serializeEvent(event)),
      summary: { dueTasks: serializedTasks.length, completed, overdue, events: events.length },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
