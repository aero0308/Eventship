import { db } from '@/lib/db'
import {
  EVENT_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from '@/lib/constants'
import { handleApiError, ok, requireUser } from '@/lib/api-utils'
import { serializeEvent, computeTaskStatsMap, emptyTaskStats } from '../_lib/events'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

/** Task include shape shared by the three focus buckets. */
const FOCUS_INCLUDE = {
  event: { select: { id: true, name: true, status: true } },
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
  event: { id: string; name: string; status: string } | null
  assignedTo: string | null
  assignee: { id: string; fullName: string; email: string } | null
  createdBy: string
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
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    estimatedHours: task.estimatedHours ?? null,
    actualHours: task.actualHours ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }
}

export async function GET() {
  try {
    await requireUser()
    const now = new Date()
    const weekFromNow = new Date(now.getTime() + WEEK_MS)

    const [
      totalEvents,
      activeEvents,
      totalTasks,
      completedTasks,
      blockedTasks,
      totalTeams,
      activeMembers,
      upcomingDeadlinesTotal,
      taskStatusGroups,
      taskPriorityGroups,
      eventStatusGroups,
    ] = await Promise.all([
      db.event.count(),
      db.event.count({ where: { status: { in: ['IN_PROGRESS', 'PLANNING'] } } }),
      db.task.count(),
      db.task.count({ where: { status: 'COMPLETED' } }),
      db.task.count({ where: { status: 'BLOCKED' } }),
      db.team.count(),
      db.user.count({ where: { isActive: true } }),
      db.task.count({
        where: { dueDate: { gte: now, lte: weekFromNow }, status: { not: 'COMPLETED' } },
      }),
      db.task.groupBy({ by: ['status'], _count: { _all: true } }),
      db.task.groupBy({ by: ['priority'], _count: { _all: true } }),
      db.event.groupBy({ by: ['status'], _count: { _all: true } }),
    ])

    const statusCounts = new Map(taskStatusGroups.map((g) => [g.status, g._count._all]))
    const priorityCounts = new Map(taskPriorityGroups.map((g) => [g.priority, g._count._all]))
    const eventStatusCounts = new Map(eventStatusGroups.map((g) => [g.status, g._count._all]))

    const [upcomingEvents, upcomingDeadlineTasks, recentActivityLogs, teams, allTasks, focusQueries] =
      await Promise.all([
        db.event.findMany({
          where: { startDate: { gte: now } },
          orderBy: { startDate: 'asc' },
          take: 5,
          include: {
            team: { select: { id: true, name: true } },
            creator: { select: { id: true, fullName: true } },
            _count: { select: { tasks: true } },
          },
        }),
        db.task.findMany({
          where: { dueDate: { gte: now }, status: { not: 'COMPLETED' } },
          orderBy: { dueDate: 'asc' },
          take: 5,
          include: {
            event: { select: { id: true, name: true, status: true } },
            assignee: { select: { id: true, fullName: true, email: true } },
          },
        }),
        db.activityLog.findMany({
          orderBy: { timestamp: 'desc' },
          take: 8,
          include: { user: { select: { id: true, fullName: true } } },
        }),
        db.team.findMany({
          orderBy: { name: 'asc' },
          select: { id: true, name: true, events: { select: { id: true } } },
        }),
        db.task.findMany({ select: { eventId: true, status: true } }),
        // ---- "My focus" buckets: due today / due within a week / overdue ----
        Promise.all([
          db.task.findMany({
            where: { dueDate: { gte: startOfDay(now), lte: endOfDay(now) }, status: { not: 'COMPLETED' } },
            orderBy: { dueDate: 'asc' },
            take: 7,
            include: FOCUS_INCLUDE,
          }),
          db.task.count({
            where: { dueDate: { gte: startOfDay(now), lte: endOfDay(now) }, status: { not: 'COMPLETED' } },
          }),
          db.task.findMany({
            where: { dueDate: { gt: endOfDay(now), lte: endOfDay(new Date(now.getTime() + WEEK_MS)) }, status: { not: 'COMPLETED' } },
            orderBy: { dueDate: 'asc' },
            take: 7,
            include: FOCUS_INCLUDE,
          }),
          db.task.count({
            where: { dueDate: { gt: endOfDay(now), lte: endOfDay(new Date(now.getTime() + WEEK_MS)) }, status: { not: 'COMPLETED' } },
          }),
          db.task.findMany({
            where: { dueDate: { lt: startOfDay(now) }, status: { not: 'COMPLETED' } },
            orderBy: { dueDate: 'asc' },
            take: 7,
            include: FOCUS_INCLUDE,
          }),
          db.task.count({
            where: { dueDate: { lt: startOfDay(now) }, status: { not: 'COMPLETED' } },
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
    const teamWorkload = teams.map((team) => ({
      teamId: team.id,
      teamName: team.name,
      openTasks: 0,
      completedTasks: 0,
    }))
    const workloadByTeam = new Map(teamWorkload.map((entry) => [entry.teamId, entry]))
    for (const task of allTasks) {
      const teamId = eventToTeam.get(task.eventId)
      if (!teamId) continue
      const entry = workloadByTeam.get(teamId)
      if (!entry) continue
      if (task.status === 'COMPLETED') entry.completedTasks += 1
      else entry.openTasks += 1
    }

    const stats = {
      totals: {
        events: totalEvents,
        activeEvents,
        tasks: totalTasks,
        completedTasks,
        blockedTasks,
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
    }

    return ok({ stats })
  } catch (error) {
    return handleApiError(error)
  }
}
