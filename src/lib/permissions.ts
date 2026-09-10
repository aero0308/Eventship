import 'server-only'
import type { User } from '@prisma/client'
import { ApiError } from '@/lib/api-utils'

/**
 * Role-based access rules:
 * - EVENT_MANAGER: full control over teams, events, tasks.
 * - TEAM_LEADER: manage events/tasks owned by their own team; full task control inside their team.
 * - EMPLOYEE: read everything, comment, and update ONLY status/actualHours of tasks assigned to them.
 */

export function isEventManager(user: Pick<User, 'role'>): boolean {
  return user.role === 'EVENT_MANAGER'
}

export function isTeamLeaderOf(user: Pick<User, 'role' | 'teamId'>, teamId: string | null): boolean {
  return user.role === 'TEAM_LEADER' && teamId !== null && user.teamId === teamId
}

/** Can the user create/edit/delete events for the given team? */
export function canManageEvents(user: Pick<User, 'role' | 'teamId'>, teamId: string | null): boolean {
  return isEventManager(user) || isTeamLeaderOf(user, teamId)
}

/** Can the user create/edit teams at all? */
export function canManageTeams(user: Pick<User, 'role'>): boolean {
  return isEventManager(user)
}

/** Can the user edit every field of a task (create/delete/full patch)? */
export function canFullyManageTask(
  user: Pick<User, 'role' | 'teamId' | 'id'>,
  task: { createdBy: string; assignedTo: string | null },
  eventTeamId: string | null
): boolean {
  if (isEventManager(user)) return true
  if (isTeamLeaderOf(user, eventTeamId)) return true
  return task.createdBy === user.id
}

/** Assert a condition or throw a uniform 403. */
export function assertAccess(condition: boolean, message = 'You do not have permission to perform this action'): void {
  if (!condition) throw new ApiError(403, message)
}
