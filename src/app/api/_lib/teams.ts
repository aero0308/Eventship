/**
 * Shared serializers + include shapes for team API routes.
 * Only imported by server route handlers.
 */
import type { Prisma } from '@prisma/client'

// ============ list shape ============

export const teamListInclude = {
  manager: { select: { id: true, fullName: true, email: true } },
  _count: { select: { members: true, events: true } },
} as const satisfies Prisma.TeamInclude

export interface TeamWithCounts {
  id: string
  name: string
  description: string | null
  managerId: string | null
  manager: { id: string; fullName: string; email: string } | null
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
