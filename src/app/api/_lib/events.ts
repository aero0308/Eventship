/**
 * Shared serializers + include shapes for event API routes.
 * Only imported by server route handlers.
 */
import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

// ============ include shape ============

export const eventInclude = {
  team: { select: { id: true, name: true } },
  creator: { select: { id: true, fullName: true } },
  _count: { select: { tasks: true } },
} as const satisfies Prisma.EventInclude

export interface EventWithRelations {
  id: string
  name: string
  description: string | null
  startDate: Date
  endDate: Date
  status: string
  teamId: string
  team: { id: string; name: string } | null
  createdBy: string
  creator: { id: string; fullName: string } | null
  _count: { tasks: number }
  createdAt: Date
  updatedAt: Date
}

// ============ task stats ============

export interface TaskStats {
  total: number
  completed: number
  inProgress: number
  blocked: number
  notStarted: number
}

export function emptyTaskStats(): TaskStats {
  return { total: 0, completed: 0, inProgress: 0, blocked: 0, notStarted: 0 }
}

/**
 * Grouped per-event task counts for a batch of event ids.
 * Every requested id gets an entry (zeros when the event has no tasks).
 */
export async function computeTaskStatsMap(eventIds: string[]): Promise<Map<string, TaskStats>> {
  const statsMap = new Map<string, TaskStats>()
  for (const id of eventIds) statsMap.set(id, emptyTaskStats())
  if (eventIds.length === 0) return statsMap

  const grouped = await db.task.groupBy({
    by: ['eventId', 'status'],
    where: { eventId: { in: eventIds } },
    _count: { _all: true },
  })

  for (const row of grouped) {
    const stats = statsMap.get(row.eventId) ?? emptyTaskStats()
    const count = row._count._all
    stats.total += count
    if (row.status === 'COMPLETED') stats.completed += count
    else if (row.status === 'IN_PROGRESS') stats.inProgress += count
    else if (row.status === 'BLOCKED') stats.blocked += count
    else if (row.status === 'NOT_STARTED') stats.notStarted += count
    statsMap.set(row.eventId, stats)
  }
  return statsMap
}

// ============ serializer ============

export function serializeEvent(event: EventWithRelations, taskStats?: TaskStats) {
  return {
    id: event.id,
    name: event.name,
    description: event.description,
    startDate: event.startDate.toISOString(),
    endDate: event.endDate.toISOString(),
    status: event.status,
    teamId: event.teamId,
    team: event.team ?? null,
    createdBy: event.createdBy,
    creator: event.creator ?? null,
    taskCount: event._count.tasks,
    ...(taskStats ? { taskStats } : {}),
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  }
}
