import { db } from '@/lib/db'
import {
  EVENT_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from '@/lib/constants'
import { handleApiError, ok } from '@/lib/api-utils'
import { requireRoomUser } from '@/lib/room'
import { serializeEvent, computeTaskStatsMap, emptyTaskStats } from '../_lib/events'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const PROGRESS_DAYS = 30

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function dayKey(date: Date): string {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Task include shape shared by the three focus buckets. */
const FOCUS_INCLUDE = {
  event: { select: { id: true, name: true, status: true, teamId: true } },
  assignee: { select: { id: true, fullName: true, email: true } },
} as const

const PRIORITY_RANK: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }

/** Urgency order for focus buckets: priority first, then due date. */
function byUrgency(a: { priority: string; dueDate: Date | null }, b: { priority: string; dueDate: Date | null }): number {
  const p = (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3)
  if (p !== 0) return p
  return (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity)
}

function serializeFocusTask(task: {
  id: string
  title: string
  description: string | null
  priority: string
  status: string
  eventId: string
  event: { id: string; name: string; status: string; teamId: string } | null
  assignedTo: string | null
  assignee: { id: string; fullName: string; email: string } | null
  createdBy: string
  startDate: Date | null
  dueDate: Date | null
  estimatedHours: number | null
  actualHours: number | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    eventId: task.eventId,
    event: task.event ?? null,
    assignedTo: task.assignedTo,
    assignee: task.assignee ?? null,
    createdBy: task.createdBy,
    startDate: task.startDate ? task.startDate.toISOString() : null,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    estimatedHours: task.estimatedHours ?? null,
    actualHours: task.actualHours ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }
}

export async function GET(request: Request) {
  try {
    // Everything below is tenant-scoped: the dashboard only ever aggregates
    // the caller's own room.
    const { user, roomId } = await requireRoomUser()
    const { searchParams } = new URL(request.url)
    // focus=mine scopes the three focus buckets to tasks assigned to the caller.
    const focusMine = searchParams.get('focus') === 'mine'
    const focusWhere = focusMine ? { roomId, assignedTo: user.id } : { roomId }
    const now = new Date()
    const weekFromNow = new Date(now.getTime() + WEEK_MS)
    const windowStart = startOfDay(new Date(now.getTime() - (PROGRESS_DAYS - 1) * 86400000))
    const isManager = user.role === 'EVENT_MANAGER'
    const isLeader = user.role === 'TEAM_LEADER'
    const canSeePerformance = isManager || isLeader

    const [
      totalEvents,
      activeEvents,
      totalTasks,
      completedTasks,
      blockedTasks,
      overdueTotal,
      totalTeams,
      activeMembers,
      upcomingDeadlinesTotal,
      taskStatusGroups,
      taskPriorityGroups,
      eventStatusGroups,
      teamMemberGroups,
    ] = await Promise.all([
      db.event.count({ where: { roomId } }),
      db.event.count({ where: { roomId, status: { in: ['IN_PROGRESS', 'PLANNING'] } } }),
      db.task.count({ where: { roomId } }),
      db.task.count({ where: { roomId, status: 'COMPLETED' } }),
      db.task.count({ where: { roomId, status: 'BLOCKED' } }),
      db.task.count({ where: { roomId, dueDate: { lt: startOfDay(now) }, status: { not: 'COMPLETED' } } }),
      db.team.count({ where: { roomId } }),
      db.user.count({ where: { roomId, isActive: true } }),
      db.task.count({
        where: { roomId, dueDate: { gte: now, lte: weekFromNow }, status: { not: 'COMPLETED' } },
      }),
      db.task.groupBy({ by: ['status'], where: { roomId }, _count: { _all: true } }),
      db.task.groupBy({ by: ['priority'], where: { roomId }, _count: { _all: true } }),
      db.event.groupBy({ by: ['status'], where: { roomId }, _count: { _all: true } }),
      db.user.groupBy({ by: ['teamId'], where: { teamId: { not: null }, isActive: true, roomId }, _count: { _all: true } }),
    ])

    const statusCounts = new Map(taskStatusGroups.map((g) => [g.status, g._count._all]))
    const priorityCounts = new Map(taskPriorityGroups.map((g) => [g.priority, g._count._all]))
    const eventStatusCounts = new Map(eventStatusGroups.map((g) => [g.status, g._count._all]))

    const [upcomingEvents, upcomingDeadlineTasks, recentActivityLogs, teams, allTasks, blockerTasks, progressRows, performerRows, focusQueries] =
      await Promise.all([
        db.event.findMany({
          where: { roomId, startDate: { gte: now } },
          orderBy: { startDate: 'asc' },
          take: 5,
          include: {
            team: { select: { id: true, name: true } },
            creator: { select: { id: true, fullName: true } },
            _count: { select: { tasks: true } },
          },
        }),
        db.task.findMany({
          where: { roomId, dueDate: { gte: now }, status: { not: 'COMPLETED' } },
          orderBy: { dueDate: 'asc' },
          take: 5,
          include: {
            event: { select: { id: true, name: true, status: true, teamId: true } },
            assignee: { select: { id: true, fullName: true, email: true } },
          },
        }),
        db.activityLog.findMany({
          where: { roomId },
          orderBy: { timestamp: 'desc' },
          take: 12,
          include: { user: { select: { id: true, fullName: true } } },
        }),
        db.team.findMany({
          where: { roomId },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, events: { select: { id: true } } },
        }),
        db.task.findMany({ where: { roomId }, select: { eventId: true, status: true } }),
        // ---- Phase 6: blockers (blocked tasks + latest blocker comment) ----
        db.task.findMany({
          where: { roomId, status: 'BLOCKED' },
          orderBy: { updatedAt: 'desc' },
          take: 6,
          include: {
            event: { select: { id: true, name: true } },
            assignee: { select: { id: true, fullName: true } },
            comments: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { user: { select: { id: true, fullName: true } } },
            },
          },
        }),
        // ---- Phase 6: 30-day progress trend (created vs completed per day) ----
        db.task.findMany({
          where: {
            roomId,
            OR: [{ createdAt: { gte: windowStart } }, { status: 'COMPLETED', updatedAt: { gte: windowStart } }],
          },
          select: { createdAt: true, updatedAt: true, status: true },
        }),
        // ---- Phase 6: per-assignee performance rows (role-gated, cheap scan) ----
        canSeePerformance
          ? db.task.findMany({
              where: isLeader && user.teamId ? { roomId, event: { teamId: user.teamId } } : { roomId },
              select: { assignedTo: true, status: true },
            })
          : Promise.resolve([] as { assignedTo: string | null; status: string }[]),
        // ---- "My focus" buckets: due today / due within a week / overdue ----
        Promise.all([
          db.task.findMany({
            where: { ...focusWhere, dueDate: { gte: startOfDay(now), lte: endOfDay(now) }, status: { not: 'COMPLETED' } },
            orderBy: { dueDate: 'asc' },
            take: 7,
            include: FOCUS_INCLUDE,
          }),
          db.task.count({
            where: { ...focusWhere, dueDate: { gte: startOfDay(now), lte: endOfDay(now) }, status: { not: 'COMPLETED' } },
          }),
          db.task.findMany({
            where: { ...focusWhere, dueDate: { gt: endOfDay(now), lte: endOfDay(new Date(now.getTime() + WEEK_MS)) }, status: { not: 'COMPLETED' } },
            orderBy: { dueDate: 'asc' },
            take: 7,
            include: FOCUS_INCLUDE,
          }),
          db.task.count({
            where: { ...focusWhere, dueDate: { gt: endOfDay(now), lte: endOfDay(new Date(now.getTime() + WEEK_MS)) }, status: { not: 'COMPLETED' } },
          }),
          db.task.findMany({
            where: { ...focusWhere, dueDate: { lt: startOfDay(now) }, status: { not: 'COMPLETED' } },
            orderBy: { dueDate: 'asc' },
            take: 7,
            include: FOCUS_INCLUDE,
          }),
          db.task.count({
            where: { ...focusWhere, dueDate: { lt: startOfDay(now) }, status: { not: 'COMPLETED' } },
          }),
        ]),
      ])

    const [dueTodayTasks, dueTodayCount, dueWeekTasks, dueWeekCount, overdueTasks, overdueCount] = focusQueries

    dueTodayTasks.sort(byUrgency)
    dueWeekTasks.sort(byUrgency)
    overdueTasks.sort(byUrgency)

    // Contract: upcomingEvents must carry per-event taskStats.
    const upcomingStatsMap = await computeTaskStatsMap(upcomingEvents.map((event) => event.id))

    // Workload: aggregate every task under the team that owns its event.
    const eventToTeam = new Map<string, string>()
    for (const team of teams) {
      for (const event of team.events) eventToTeam.set(event.id, team.id)
    }
    const memberCountByTeam = new Map<string, number>()
    for (const group of teamMemberGroups) {
      if (group.teamId) memberCountByTeam.set(group.teamId, group._count._all)
    }
    const teamWorkload = teams.map((team) => ({
      teamId: team.id,
      teamName: team.name,
      openTasks: 0,
      completedTasks: 0,
      blockedTasks: 0,
      memberCount: memberCountByTeam.get(team.id) ?? 0,
      completionRate: 0,
    }))
    const workloadByTeam = new Map(teamWorkload.map((entry) => [entry.teamId, entry]))
    for (const task of allTasks) {
      const teamId = eventToTeam.get(task.eventId)
      if (!teamId) continue
      const entry = workloadByTeam.get(teamId)
      if (!entry) continue
      if (task.status === 'COMPLETED') entry.completedTasks += 1
      else if (task.status === 'BLOCKED') entry.blockedTasks += 1
      else entry.openTasks += 1
    }
    // Completion rate per team (Phase 6 team-performance metrics).
    for (const team of teamWorkload) {
      const total = team.openTasks + team.completedTasks
      team.completionRate = total > 0 ? Math.round((team.completedTasks / total) * 100) : 0
    }

    // ---- Phase 6: 30-day progress trend (single pass over the rows) ----
    const createdByDay = new Map<string, number>()
    const completedByDay = new Map<string, number>()
    for (const row of progressRows) {
      const created = dayKey(row.createdAt)
      if (row.createdAt >= windowStart) createdByDay.set(created, (createdByDay.get(created) ?? 0) + 1)
      if (row.status === 'COMPLETED' && row.updatedAt >= windowStart) {
        const completed = dayKey(row.updatedAt)
        completedByDay.set(completed, (completedByDay.get(completed) ?? 0) + 1)
      }
    }
    const progressOverTime: { date: string; created: number; completed: number; cumulativeCompleted: number }[] = []
    let cumulative = 0
    for (let i = PROGRESS_DAYS - 1; i >= 0; i -= 1) {
      const key = dayKey(new Date(now.getTime() - i * 86400000))
      const created = createdByDay.get(key) ?? 0
      const completed = completedByDay.get(key) ?? 0
      cumulative += completed
      progressOverTime.push({ date: key, created, completed, cumulativeCompleted: cumulative })
    }

    // ---- Phase 6: top performers (managers = whole org, leaders = their team) ----
    const perfByUser = new Map<string, { total: number; completed: number; inProgress: number; blocked: number }>()
    for (const row of performerRows) {
      if (!row.assignedTo) continue
      const entry = perfByUser.get(row.assignedTo) ?? { total: 0, completed: 0, inProgress: 0, blocked: 0 }
      entry.total += 1
      if (row.status === 'COMPLETED') entry.completed += 1
      else if (row.status === 'IN_PROGRESS') entry.inProgress += 1
      else if (row.status === 'BLOCKED') entry.blocked += 1
      perfByUser.set(row.assignedTo, entry)
    }
    const performerUserIds = [...perfByUser.keys()]
    const performerUsers = performerUserIds.length
      ? await db.user.findMany({
          where: { id: { in: performerUserIds }, isActive: true, roomId },
          select: { id: true, fullName: true, email: true },
        })
      : []
    const topPerformers = performerUsers
      .map((u) => {
        const entry = perfByUser.get(u.id)! // non-null asserted: id came from the map keys
        return {
          userId: u.id,
          fullName: u.fullName,
          email: u.email,
          totalTasks: entry.total,
          completedTasks: entry.completed,
          inProgressTasks: entry.inProgress,
          blockedTasks: entry.blocked,
          completionRate: Math.round((entry.completed / entry.total) * 100),
        }
      })
      .sort((a, b) => b.completionRate - a.completionRate || b.completedTasks - a.completedTasks)
      .slice(0, 5)

    const stats = {
      totals: {
        events: totalEvents,
        activeEvents,
        tasks: totalTasks,
        completedTasks,
        blockedTasks,
        overdueTasks: overdueTotal,
        teams: totalTeams,
        members: activeMembers,
        upcomingDeadlines: upcomingDeadlinesTotal,
      },
      tasksByStatus: TASK_STATUSES.map((status) => ({
        status,
        count: statusCounts.get(status) ?? 0,
      })),
      tasksByPriority: TASK_PRIORITIES.map((priority) => ({
        priority,
        count: priorityCounts.get(priority) ?? 0,
      })),
      eventsByStatus: EVENT_STATUSES.map((status) => ({
        status,
        count: eventStatusCounts.get(status) ?? 0,
      })),
      upcomingEvents: upcomingEvents.map((event) =>
        serializeEvent(event, upcomingStatsMap.get(event.id) ?? emptyTaskStats())
      ),
      upcomingDeadlines: upcomingDeadlineTasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        eventId: task.eventId,
        event: task.event ?? null,
        assignedTo: task.assignedTo,
        assignee: task.assignee ?? null,
        createdBy: task.createdBy,
        startDate: task.startDate ? task.startDate.toISOString() : null,
        dueDate: task.dueDate ? task.dueDate.toISOString() : null,
        estimatedHours: task.estimatedHours ?? null,
        actualHours: task.actualHours ?? null,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      })),
      recentActivity: recentActivityLogs.map((log) => ({
        id: log.id,
        userId: log.userId,
        user: log.user ?? null,
        action: log.action,
        details: log.details,
        timestamp: log.timestamp.toISOString(),
      })),
      teamWorkload,
      myFocus: {
        dueToday: { count: dueTodayCount, tasks: dueTodayTasks.map(serializeFocusTask) },
        dueThisWeek: { count: dueWeekCount, tasks: dueWeekTasks.map(serializeFocusTask) },
        overdue: { count: overdueCount, tasks: overdueTasks.map(serializeFocusTask) },
      },
      completionRate:
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      // ---- Phase 6 additions ----
      blockers: blockerTasks.map((task) => ({
        id: task.id,
        title: task.title,
        priority: task.priority,
        eventId: task.eventId,
        eventName: task.event?.name ?? null,
        assigneeName: task.assignee?.fullName ?? null,
        dueDate: task.dueDate ? task.dueDate.toISOString() : null,
        daysBlocked: Math.max(0, Math.floor((now.getTime() - task.updatedAt.getTime()) / 86400000)),
        latestComment: task.comments[0]
          ? {
              content: task.comments[0].content,
              authorName: task.comments[0].user?.fullName ?? null,
              createdAt: task.comments[0].createdAt.toISOString(),
            }
          : null,
      })),
      progressOverTime,
      topPerformers,
    }

    return ok({ stats })
  } catch (error) {
    return handleApiError(error)
  }
}
