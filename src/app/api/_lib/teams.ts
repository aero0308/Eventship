/**
 * Shared serializers + include shapes for team API routes.
 * Only imported by server route handlers.
 */
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

// ============ list shape ============

export const teamListInclude = {
  manager: { select: { id: true, fullName: true, email: true } },
  members: {
    select: { id: true, fullName: true },
    orderBy: { fullName: 'asc' as const },
    take: 5,
  },
  _count: { select: { members: true, events: true } },
} as const satisfies Prisma.TeamInclude

export interface TeamWithCounts {
  id: string
  name: string
  description: string | null
  managerId: string | null
  manager: { id: string; fullName: string; email: string } | null
  members: { id: string; fullName: string }[]
  _count: { members: number; events: number }
  createdAt: Date
  updatedAt: Date
}

// ============ detail shape ============

export const teamDetailInclude = {
  manager: { select: { id: true, fullName: true, email: true } },
  members: {
    select: { id: true, fullName: true, email: true, role: true },
    orderBy: { fullName: 'asc' },
  },
  events: {
    select: { id: true, name: true, status: true, startDate: true, endDate: true },
    orderBy: { startDate: 'desc' },
  },
  _count: { select: { members: true, events: true } },
} as const satisfies Prisma.TeamInclude

export interface TeamWithMembers extends TeamWithCounts {
  members: { id: string; fullName: string; email: string; role: string }[]
  events: { id: string; name: string; status: string; startDate: Date; endDate: Date }[]
}

// ============ serializers ============

export function serializeTeamList(team: TeamWithCounts) {
  return {
    id: team.id,
    name: team.name,
    description: team.description,
    managerId: team.managerId,
    manager: team.manager ?? null,
    // Avatar-stack preview (up to 5 members, alphabetical).
    members: team.members,
    memberCount: team._count.members,
    eventCount: team._count.events,
    createdAt: team.createdAt.toISOString(),
    updatedAt: team.updatedAt.toISOString(),
  }
}

export function serializeTeamDetail(team: TeamWithMembers) {
  return {
    ...serializeTeamList(team),
    members: team.members,
    events: team.events.map((event) => ({
      id: event.id,
      name: event.name,
      status: event.status,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
    })),
  }
}

// ============ task stats (Phase 3 TeamStats) ============

export interface TeamTaskStats {
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  blockedTasks: number
  overdueTasks: number
  completionRate: number
}

const EMPTY_TASK_STATS: TeamTaskStats = {
  totalTasks: 0,
  completedTasks: 0,
  inProgressTasks: 0,
  blockedTasks: 0,
  overdueTasks: 0,
  completionRate: 0,
}

/**
 * Aggregate task health across the given events (tasks always belong to an
 * event, and events belong to a team). One groupBy + one overdue count —
 * cheap enough to ride on every detail response.
 */
export async function computeTeamStats(eventIds: string[]): Promise<TeamTaskStats> {
  if (eventIds.length === 0) return EMPTY_TASK_STATS

  const now = new Date()
  const [byStatus, overdue] = await Promise.all([
    db.task.groupBy({
      by: ['status'],
      where: { eventId: { in: eventIds } },
      _count: { _all: true },
    }),
    db.task.count({
      where: { eventId: { in: eventIds }, status: { not: 'COMPLETED' }, dueDate: { lt: now } },
    }),
  ])

  let total = 0
  let completed = 0
  let inProgress = 0
  let blocked = 0
  for (const row of byStatus) {
    total += row._count._all
    if (row.status === 'COMPLETED') completed = row._count._all
    else if (row.status === 'IN_PROGRESS') inProgress = row._count._all
    else if (row.status === 'BLOCKED') blocked = row._count._all
  }

  return {
    totalTasks: total,
    completedTasks: completed,
    inProgressTasks: inProgress,
    blockedTasks: blocked,
    overdueTasks: overdue,
    completionRate: total === 0 ? 0 : Math.round((completed / total) * 100),
  }
}
